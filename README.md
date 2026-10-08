# WhatsApp Game Bot

Bot coletivo em português, sem banco de dados. Cada grupo possui fila, sessão, timers e cooldown independentes. Inclui quiz com 110 perguntas, número, palavra embaralhada, emojis e forca.

## Instalação

Use Node.js 24 LTS e npm. Ambiente verificado: Node 24.19.0. Baileys está fixado em `7.0.0-rc14` (release candidate); o lockfile fixa as dependências.

```powershell
npm.cmd ci
Copy-Item .env.example .env
# Edite .env antes de iniciar
npm.cmd run dev
```

No Linux use `npm` e `cp .env.example .env`. No Windows, `npm.cmd` evita a restrição de execução de npm.ps1 sem modificar a política do sistema.

```dotenv
OWNER_JID=
ALLOWED_GROUP_IDS=
AUTH_DIR=./auth
CONFIG_FILE=./runtime/config.json
LOG_LEVEL=info
```

O proprietário deve ser o número completo com país e DDD, sem pontuação, seguido de `@s.whatsapp.net`, ou um JID `@lid` conhecido e verificado. Nomes e cargos de administrador não autorizam ninguém. Use preferencialmente um número de proprietário diferente do número conectado ao bot: mensagens do próprio bot são ignoradas, inclusive administrativas.

Exceção solicitada para a fase de teste: o proprietário pode enviar `/bot` usando o próprio número conectado. A identidade é comparada com a conta autenticada do socket; os comandos /bot e /jogo têm essa exceção, sem aceitar respostas geradas pelo bot.

Essa exceção inclui eventos append do próprio proprietário com timestamp recente e posterior ao início do processo, sem requestId. Histórico permanece ignorado. Envelopes de mensagens temporárias e de dispositivo são abertos de forma limitada; edições e protocolos continuam descartados. O diagnóstico de /bot registra apenas tipo de evento, flags e idade, sem conteúdo da conversa.

Proteja `.env`, `auth/` e `runtime/` pela conta do serviço. Nunca publique QR, credenciais ou backups. O processo aplica umask 077 e diretório de autenticação 0700 no Linux. No Windows, restrinja os diretórios pelas ACLs do usuário do serviço. Esses caminhos estão excluídos do Git.

## Conectar e escolher grupos

1. Execute `npm.cmd run app` e abra o painel ou a extens?o lateral.
2. Leia o QR em **WhatsApp ? Aparelhos conectados ? Conectar aparelho**. Se j? houver uma sess?o v?lida, o sistema a reutiliza.
3. Os grupos em que a conta participa aparecem no painel. N?o ? necess?rio cadastrar seus JIDs manualmente.
4. Selecione qualquer grupo e clique em **Autorizar grupo**. Depois escolha jogo, varia??o e configura??es.
5. Voc? pode remover a autoriza??o individualmente; isso encerra a partida daquele grupo.
6. Como alternativa, o propriet?rio fixo pode usar `/config grupos adicionar JID` e `/config grupos listar` no privado. `ALLOWED_GROUP_IDS` continua dispon?vel para instala??es configuradas por arquivo.

O JSON, quando existe, tem precedência sobre `ALLOWED_GROUP_IDS` para manter inclusões e remoções após reinício. Para reconstruir pelo ambiente, pare o bot e arquive o JSON. O proprietário sempre vem do ambiente.

LIDs são resolvidos pelo repositório de identidade autenticada do Baileys. `participantAlt` isolado não concede autorização. LID não resolvido falha com segurança para proprietário PN; participantes podem iniciar e responder jogos usando o LID autenticado, com identidade de jogo fixada por sessão de conexão para preservar cooldowns quando o mapeamento chega depois. Proprietário explicitamente cadastrado por LID é autorizado pelo LID primário.

## Jogos

Envie `/bot` no grupo autorizado para a apresentação: “Olá! Sou o bot de jogos da ETH, em fase de teste.” Há um intervalo de 10 segundos entre apresentações.

```text
/jogo
/jogo quiz
/jogo numero
/jogo palavra
/jogo emoji
/jogo forca
/r C
```

`/jogo` reserva a seleção por 30s. Qualquer participante escolhe com `/jogo modalidade`. Outro menu não cria segunda reserva. Palpites são mensagens normais; quiz aceita A–D ou `/r C`. `/r resposta` funciona nos outros jogos também.

Defaults: quiz 60s; número/palavra/emoji 90s; forca 120s; intervalo entre partidas 20s; um palpite por participante a cada 2s. Tentativas inválidas também passam pelo limite de frequência. O primeiro acerto processado na fila vence; não há promessa sobre quem digitou primeiro no telefone.

Na forca, letras erradas consomem uma das seis tentativas da equipe; letras repetidas não gastam tentativas. Palavra completa incorreta não consome tentativa. A última letra que completa a palavra declara vencedor. Respostas erradas ficam silenciosas, exceto a atualização coletiva da forca.

## Administração exclusiva do proprietário

```text
/config
/config status
/config jogos on
/config jogos off
/config modalidade quiz off
/config modalidade forca on
/config tempo 90
/config tempo quiz 60
/config cooldown 20
/config palpites 2
/config intervalo 1 100
/config encerrar
/config grupos listar
/config grupos adicionar 120363000000000000@g.us
/config grupos remover 120363000000000000@g.us
```

No privado, direcione os comandos ao grupo:

```text
/config grupo 120363000000000000@g.us tempo quiz 90
/config grupo 120363000000000000@g.us encerrar
```

Limites: tempo 10–600s; intervalo entre partidas 0–3600s; palpites 0–60s; números inteiros de 1 a 1000000, mínimo menor que máximo. Tempos e intervalo numérico afetam a próxima rodada. Desligar jogos ou a modalidade atual cancela a partida. Usuários não autorizados não recebem resposta, evitando spam e exposição do menu.

Configurações são individuais por grupo e persistidas com arquivo temporário e rename, em fila serial. JSON inválido impede o início. Falha de disco é registrada e não recebe confirmação de persistência; a alteração em memória pode já ter ocorrido. Corrija permissões/espaço e reaplique o comando antes de reiniciar.

## Testes e produção

```powershell
npm.cmd test
npm.cmd run check
npm.cmd run build
npm.cmd start
```

Testes usam transporte simulado apenas na suíte. Cobrem concorrência com Promise.all, vitória única antes do envio, duplicatas, deadlines, sessões antigas, cooldowns, forca, permissões PN/LID, falhas de rede, mensagens malformadas e isolamento. A conexão real exige seu QR e grupo autorizado.

Execute uma única instância, sem cluster ou réplicas. Use conta de serviço e supervisor como systemd ou Docker. Preserve `auth/` e `runtime/`; partidas não sobrevivem ao reinício.

```sh
docker build -t whatsapp-game-bot .
docker run -d --name whatsapp-game-bot --restart unless-stopped --env-file .env -v "$PWD/auth:/app/auth" -v "$PWD/runtime:/app/runtime" whatsapp-game-bot
docker logs -f whatsapp-game-bot
```

No Windows adapte os volumes para caminhos absolutos. Leia o QR em terminal privado. Não há portas nem painel web.

Desconexão cancela partidas e bloqueia novos jogos. Reconexão usa um único timer com backoff de 1 até 60s e jitter. Logout, sessão inválida, conexão substituída ou bloqueio exigem intervenção manual. Em logout, pare o serviço, arquive a pasta de sessão com segurança e conecte novamente. SIGINT/SIGTERM fecha socket e limpa timers.

## Integridade e limitações

- GameManager não importa Baileys. Reserva ocorre antes de qualquer envio assíncrono; operações por grupo são serializadas. Grupos distintos continuam em paralelo.
- Vencedor e FINISHING são registrados antes de aguardar anúncio. Timeout é cancelado e não há retry de vitória: uma falha de envio pode ocultar o anúncio, mas não gera outro vencedor.
- Respostas capturam ID da sessão antes da fila. Timeout também verifica ID. Citações de perguntas antigas são descartadas. Respostas anteriores à publicação, duplicadas ou após o deadline não vencem.
- WhatsApp fornece timestamps com resolução de segundos. Por segurança, mensagens do mesmo segundo parcial da publicação são ignoradas: aguarde até o próximo segundo para responder. Não existe identificador de rodada no texto de um palpite simples não citado. Timestamp incorreto ou atrasos da rede são uma limitação; cite a pergunta atual para eliminar ambiguidade entre rodadas. A proteção combina timestamp, sessão capturada e ID da pergunta citada.
- Só mensagens notify sem requestId, texto direto e idade até 15s são elegíveis. Histórico, sincronização, edições, revogações, mídias e envelopes não textuais são ignorados conservadoramente. Mensagens anteriores ao boot são descartadas. Editar uma mensagem depois de seu processamento não desfaz uma vitória válida.
- A sincronização inicial padrão do Baileys é mantida para carregar mapeamentos LID. Histórico completo está desativado; mensagens antigas sincronizadas nunca são encaminhadas aos jogos.
- Cache de IDs é limitado a 10000 entradas com TTL de 5min; cooldowns vencidos são removidos. Histórico de perguntas por grupo/modalidade é limitado.
- Credenciais usam useMultiFileAuthState para o único processo solicitado; a documentação alerta para custo de I/O em escala. Não compartilhe a sessão entre processos.
- Baileys é não oficial, sem garantia de continuidade pelo WhatsApp. Mudanças do serviço podem exigir atualização. Revise documentação e testes antes de atualizar. Não há publicidade ou disparos em massa.
- sendMessage confirma envio conforme a biblioteca, não leitura/recebimento por todos. Falha explícita cancela a reserva sem ativar rodada invisível.

Interfaces verificadas nos tipos da versão instalada: WAMessageKey.participantAlt, remoteJidAlt, signalRepository.lidMapping.getPNForLID, cachedGroupMetadata, messages.upsert, DisconnectReason e useMultiFileAuthState.

Referências oficiais: [migração v7 e LIDs](https://github.com/WhiskeySockets/baileys.wiki-site/blob/main/docs/migration/to-v7.0.0.md), [eventos de mensagens](https://github.com/WhiskeySockets/baileys.wiki-site/blob/main/docs/socket/receiving-updates.md), [Baileys](https://github.com/WhiskeySockets/Baileys).

## Manutenção e expansão

Em `src/data/questions.ts`, cada item tem pergunta, resposta de exibição, quatro alternativas e letra correta. São 110 perguntas em categorias variadas. Acrescente itens e rode os testes. `words.ts` e `emojis.ts` contêm dicas e aliases explícitos; não há correspondência aproximada. Dicas desambiguam as palavras embaralhadas.

Para adicionar modalidade, implemente Game.create e Game.guess, registre em game-types.ts e registry.ts, acrescente defaults de modalidade/duração, menu, parser e testes. Jogos são síncronos e independentes do transporte. Só o gerenciador envia mensagens e administra sessões. GroupQueue, ConfigStore e a interface Send delimitam infraestrutura. Persistência futura exigirá repositório e transações distribuídas no gerenciador, sem reescrever os jogos; não basta criar réplicas do estado em memória.

## Validação manual final

Conecte via QR, autorize o grupo e execute `/jogo quiz`. Envie a alternativa correta com dois participantes e confirme uma única menção vencedora. Tente iniciar outro jogo durante a rodada, aguarde o intervalo e execute `/jogo forca`. Verifique que participante comum e administrador não conseguem `/config jogos off`, mas o proprietário consegue. Essa etapa depende da sua conta WhatsApp e deve ser realizada no seu ambiente.
