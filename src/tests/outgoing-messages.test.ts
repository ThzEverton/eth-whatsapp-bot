import {afterEach, expect, it, vi} from "vitest";
import {ConfigStore} from "../config/settings.js";
import {ConfigCommand} from "../commands/config.js";
import {PermissionService} from "../services/permission-service.js";
import {GameManager} from "../games/game-manager.js";
import {MessageHandler} from "../bot/message-handler.js";

const group="120363430060189010@g.us";
const self="5511999999999@s.whatsapp.net";
const notCurrentOwner="5511888888888@s.whatsapp.net";

afterEach(()=>vi.useRealTimers());
function setup(owner=notCurrentOwner){
  vi.useFakeTimers();vi.setSystemTime(2000000000000);
  let seq=0;
  const sent:string[]=[];
  const send=vi.fn(async(_chat:string,text:string)=>{sent.push(text);return "bot-"+(++seq)});
  const manager=new GameManager(new ConfigStore([group]),send);
  manager.ready=true;
  const handler=new MessageHandler(
    manager,
    new ConfigCommand(new PermissionService(owner),manager,send),
    async()=>null,
    e=>{throw e},
    ()=>self,
  );
  const message=(text:string,id:string,fromMe=true)=>({
    key:{remoteJid:group,id,fromMe,participant:fromMe?undefined:"5511777777777@s.whatsapp.net"},
    message:{conversation:text},
    messageTimestamp:Date.now()/1000,
  });
  return {handler,manager,sent,message,send};
}

it("aceita /jogo enviado do proprio WhatsApp como append mesmo se nao for dono do /config",async()=>{
  const {handler,manager,sent,message}=setup();
  try{
    await handler.handle(message("/jogo","owner-menu"),"append");
    expect(sent.some(x=>x.includes("CENTRAL"))).toBe(true);
    expect(manager.session(group)?.status).toBe("SELECTING");
    await handler.handle(message("/jogo quiz","owner-quiz"),"append");
    expect(manager.session(group)?.status).toBe("ACTIVE");
    const expected=manager.session(group)!.answer!;
    await handler.handle(message(expected,"owner-answer"),"append");
    expect(sent.filter(x=>x.includes("TEMOS UM VENCEDOR"))).toHaveLength(1);
    expect(manager.session(group)).toBeUndefined();
  }finally{manager.shutdown()}
});

it("notificacao notify de /jogo tambem e processada sem duplicar",async()=>{
  const {handler,manager,sent,message}=setup();
  try{
    await handler.handle(message("/jogo","same"),"notify");
    await handler.handle(message("/jogo","same"),"append");
    expect(sent.filter(x=>x.includes("CENTRAL"))).toHaveLength(1);
  }finally{manager.shutdown()}
});

it("eco de mensagem gerada pelo proprio bot nao dispara comando nem resposta",async()=>{
  const {handler,manager,sent,message}=setup();
  try{
    handler.markBotMessage(group,"bot-command");
    await handler.handle(message("/jogo","bot-command"),"append");
    expect(sent).toHaveLength(0);
    await handler.handle(message("/jogo quiz","owner-quiz"),"append");
    expect(manager.session(group)?.status).toBe("ACTIVE");
    const expected=manager.session(group)!.answer!;
    handler.markBotMessage(group,"bot-answer");
    await handler.handle(message(expected,"bot-answer"),"notify");
    expect(manager.session(group)?.status).toBe("ACTIVE");
    expect(sent.filter(x=>x.includes("TEMOS UM VENCEDOR"))).toHaveLength(0);
  }finally{manager.shutdown()}
});

it("mensagem historica e /config de outro proprietario nao executam",async()=>{
 const {handler,manager,sent,message}=setup();
 try{
  await handler.handle(message("/jogo","old"),"append","request-123");
  await handler.handle(message("/config status","not-owner"),"append");
  expect(sent).toHaveLength(0);
  expect(manager.session(group)).toBeUndefined();
 }finally{manager.shutdown()}
});
