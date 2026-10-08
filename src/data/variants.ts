export interface Theme {
  id: string;
  name: string;
  entries: { word: string; hint: string; emoji: string }[];
}
export const themes: Theme[] = [
  {
    id: "animais",
    name: "Animais",
    entries: [
      {
        word: "girafa",
        hint: "Animal de pesco?o comprido",
        emoji: "??",
      },
      {
        word: "elefante",
        hint: "Animal com tromba",
        emoji: "??",
      },
      {
        word: "tartaruga",
        hint: "R?ptil com casco",
        emoji: "??",
      },
      {
        word: "borboleta",
        hint: "Inseto de asas coloridas",
        emoji: "??",
      },
    ],
  },
  {
    id: "frutas",
    name: "Frutas",
    entries: [
      {
        word: "abacaxi",
        hint: "Fruta com coroa",
        emoji: "??",
      },
      {
        word: "morango",
        hint: "Fruta vermelha com sementes por fora",
        emoji: "??",
      },
      {
        word: "banana",
        hint: "Fruta amarela vendida em pencas",
        emoji: "??",
      },
      {
        word: "melancia",
        hint: "Fruta de casca verde e polpa vermelha",
        emoji: "??",
      },
    ],
  },
  {
    id: "cozinha",
    name: "Cozinha",
    entries: [
      {
        word: "panela",
        hint: "Recipiente usado para cozinhar no fog?o",
        emoji: "????",
      },
      {
        word: "faca",
        hint: "Utens?lio que corta alimentos",
        emoji: "??",
      },
      {
        word: "colher",
        hint: "Utens?lio usado para tomar sopa",
        emoji: "??",
      },
      {
        word: "geladeira",
        hint: "Eletrodom?stico que mant?m alimentos frios",
        emoji: "????",
      },
    ],
  },
  {
    id: "esportes",
    name: "Esportes",
    entries: [
      {
        word: "futebol",
        hint: "Esporte com gols e onze jogadores por equipe",
        emoji: "???",
      },
      {
        word: "basquete",
        hint: "Esporte em que a bola passa por um aro",
        emoji: "??",
      },
      {
        word: "tenis",
        hint: "Esporte de raquete com sets",
        emoji: "??",
      },
      {
        word: "natacao",
        hint: "Esporte praticado em piscinas",
        emoji: "??",
      },
    ],
  },
  {
    id: "espaco",
    name: "Espa?o",
    entries: [
      {
        word: "foguete",
        hint: "Ve?culo lan?ado ao espa?o",
        emoji: "??",
      },
      {
        word: "astronauta",
        hint: "Pessoa que viaja ao espa?o",
        emoji: "?????",
      },
      {
        word: "lua",
        hint: "Sat?lite natural da Terra",
        emoji: "??",
      },
      {
        word: "saturno",
        hint: "Planeta famoso por seus an?is",
        emoji: "??",
      },
    ],
  },
  {
    id: "natureza",
    name: "Natureza",
    entries: [
      {
        word: "montanha",
        hint: "Grande eleva??o natural do terreno",
        emoji: "??",
      },
      {
        word: "oceano",
        hint: "Grande extens?o de ?gua salgada",
        emoji: "??",
      },
      {
        word: "vulcao",
        hint: "Estrutura geol?gica que pode expelir lava",
        emoji: "??",
      },
      {
        word: "floresta",
        hint: "?rea com grande concentra??o de ?rvores",
        emoji: "??????",
      },
    ],
  },
  {
    id: "musica",
    name: "M?sica",
    entries: [
      {
        word: "violino",
        hint: "Instrumento de cordas tocado com arco",
        emoji: "??",
      },
      {
        word: "piano",
        hint: "Instrumento com teclas pretas e brancas",
        emoji: "??",
      },
      {
        word: "trompete",
        hint: "Instrumento de sopro com pist?es",
        emoji: "??",
      },
      {
        word: "bateria",
        hint: "Conjunto de tambores e pratos",
        emoji: "??",
      },
    ],
  },
  {
    id: "transportes",
    name: "Transportes",
    entries: [
      {
        word: "bicicleta",
        hint: "Ve?culo de duas rodas movido por pedais",
        emoji: "??",
      },
      {
        word: "aviao",
        hint: "Ve?culo de asas usado em voos",
        emoji: "??",
      },
      {
        word: "trem",
        hint: "Ve?culo que circula sobre trilhos",
        emoji: "??",
      },
      {
        word: "barco",
        hint: "Embarca??o que navega na ?gua",
        emoji: "?",
      },
    ],
  },
  {
    id: "profissoes",
    name: "Profiss?es",
    entries: [
      {
        word: "medico",
        hint: "Profissional que diagnostica e trata doen?as",
        emoji: "?????",
      },
      {
        word: "bombeiro",
        hint: "Profissional que combate inc?ndios",
        emoji: "?????",
      },
      {
        word: "professor",
        hint: "Profissional que ensina em uma escola",
        emoji: "?????",
      },
      {
        word: "cozinheiro",
        hint: "Profissional que prepara refei??es",
        emoji: "?????",
      },
    ],
  },
  {
    id: "tecnologia",
    name: "Tecnologia",
    entries: [
      {
        word: "computador",
        hint: "M?quina program?vel usada para processar dados",
        emoji: "??",
      },
      {
        word: "teclado",
        hint: "Dispositivo com teclas para digitar",
        emoji: "??",
      },
      {
        word: "impressora",
        hint: "Equipamento que transfere documentos para papel",
        emoji: "???",
      },
      {
        word: "robo",
        hint: "M?quina que pode executar tarefas automaticamente",
        emoji: "??",
      },
    ],
  },
  {
    id: "casa",
    name: "Casa",
    entries: [
      {
        word: "cama",
        hint: "M?vel usado para dormir",
        emoji: "???",
      },
      {
        word: "porta",
        hint: "Abertura m?vel usada para entrar em um c?modo",
        emoji: "??",
      },
      {
        word: "sofa",
        hint: "Assento estofado para v?rias pessoas",
        emoji: "???",
      },
      {
        word: "chuveiro",
        hint: "Equipamento que libera ?gua para o banho",
        emoji: "??",
      },
    ],
  },
  {
    id: "escola",
    name: "Escola",
    entries: [
      {
        word: "livro",
        hint: "Objeto com p?ginas encadernadas para leitura",
        emoji: "??",
      },
      {
        word: "lapis",
        hint: "Instrumento de escrita com grafite",
        emoji: "??",
      },
      {
        word: "mochila",
        hint: "Bolsa carregada nas costas",
        emoji: "??",
      },
      {
        word: "regua",
        hint: "Instrumento usado para medir e tra?ar linhas",
        emoji: "??",
      },
    ],
  },
  {
    id: "clima",
    name: "Clima",
    entries: [
      {
        word: "chuva",
        hint: "Precipita??o de gotas de ?gua",
        emoji: "???",
      },
      {
        word: "neve",
        hint: "Precipita??o de cristais de gelo",
        emoji: "??",
      },
      {
        word: "trovao",
        hint: "Som produzido por uma descarga el?trica atmosf?rica",
        emoji: "???",
      },
      {
        word: "arcoiris",
        hint: "Arco colorido formado pela luz em gotas de ?gua",
        emoji: "??",
      },
    ],
  },
  {
    id: "jardim",
    name: "Jardim",
    entries: [
      {
        word: "girassol",
        hint: "Flor amarela cujo nome lembra uma estrela",
        emoji: "??",
      },
      {
        word: "rosa",
        hint: "Flor frequentemente associada ao romance",
        emoji: "??",
      },
      {
        word: "cacto",
        hint: "Planta suculenta frequentemente coberta de espinhos",
        emoji: "??",
      },
      {
        word: "tulipa",
        hint: "Flor em forma de ta?a comum na Holanda",
        emoji: "??",
      },
    ],
  },
  {
    id: "mar",
    name: "Vida marinha",
    entries: [
      {
        word: "polvo",
        hint: "Animal marinho com oito bra?os",
        emoji: "??",
      },
      {
        word: "tubarao",
        hint: "Peixe marinho com esqueleto cartilaginoso",
        emoji: "??",
      },
      {
        word: "golfinho",
        hint: "Mam?fero aqu?tico conhecido por seus saltos",
        emoji: "??",
      },
      {
        word: "caranguejo",
        hint: "Crust?ceo com pin?as que costuma andar de lado",
        emoji: "??",
      },
    ],
  },
  {
    id: "doces",
    name: "Doces",
    entries: [
      {
        word: "chocolate",
        hint: "Doce produzido com cacau",
        emoji: "??",
      },
      {
        word: "sorvete",
        hint: "Sobremesa gelada servida em casquinha ou pote",
        emoji: "??",
      },
      {
        word: "bolo",
        hint: "Doce frequentemente servido em anivers?rios",
        emoji: "??",
      },
      {
        word: "pirulito",
        hint: "Doce preso na ponta de um palito",
        emoji: "??",
      },
    ],
  },
  {
    id: "aventura",
    name: "Aventura",
    entries: [
      {
        word: "bussola",
        hint: "Instrumento que indica o norte magn?tico",
        emoji: "??",
      },
      {
        word: "barraca",
        hint: "Abrigo port?til usado em acampamentos",
        emoji: "?",
      },
      {
        word: "mapa",
        hint: "Representa??o gr?fica de uma regi?o",
        emoji: "???",
      },
      {
        word: "lanterna",
        hint: "Fonte port?til de luz",
        emoji: "??",
      },
    ],
  },
  {
    id: "festas",
    name: "Festas",
    entries: [
      {
        word: "balao",
        hint: "Objeto infl?vel usado em decora??es",
        emoji: "??",
      },
      {
        word: "presente",
        hint: "Objeto dado a algu?m em uma ocasi?o especial",
        emoji: "??",
      },
      {
        word: "confete",
        hint: "Pequenos pap?is coloridos lan?ados em festas",
        emoji: "??",
      },
      {
        word: "mascara",
        hint: "Objeto que cobre o rosto em festas ? fantasia",
        emoji: "??",
      },
    ],
  },
  {
    id: "roupas",
    name: "Roupas",
    entries: [
      {
        word: "camisa",
        hint: "Pe?a de roupa que cobre o tronco",
        emoji: "??",
      },
      {
        word: "vestido",
        hint: "Pe?a ?nica de roupa que inclui uma saia",
        emoji: "??",
      },
      {
        word: "luva",
        hint: "Pe?a usada para proteger a m?o",
        emoji: "??",
      },
      {
        word: "cachecol",
        hint: "Pe?a comprida usada ao redor do pesco?o",
        emoji: "??",
      },
    ],
  },
  {
    id: "ferramentas",
    name: "Ferramentas",
    entries: [
      {
        word: "martelo",
        hint: "Ferramenta usada para bater pregos",
        emoji: "??",
      },
      {
        word: "serrote",
        hint: "Ferramenta manual dentada para cortar madeira",
        emoji: "??",
      },
      {
        word: "chave",
        hint: "Objeto usado para abrir uma fechadura",
        emoji: "??",
      },
      {
        word: "tesoura",
        hint: "Instrumento de duas l?minas usado para cortar",
        emoji: "??",
      },
    ],
  },
  {
    id: "lugares",
    name: "Lugares",
    entries: [
      {
        word: "hospital",
        hint: "Local de atendimento m?dico e interna??o",
        emoji: "??",
      },
      {
        word: "banco",
        hint: "Institui??o que oferece contas e servi?os financeiros",
        emoji: "??",
      },
      {
        word: "castelo",
        hint: "Constru??o fortificada associada a reis",
        emoji: "??",
      },
      {
        word: "estadio",
        hint: "Local com arquibancadas para eventos esportivos",
        emoji: "???",
      },
    ],
  },
];
export const variantIds = ["classico", ...themes.map((t) => t.id)];
export const variantCatalog = [
  { id: "classico", name: "Cl?ssico" },
  ...themes.map(({ id, name }) => ({ id, name })),
];
export function validVariant(value: unknown): value is string {
  return typeof value === "string" && variantIds.includes(value);
}
