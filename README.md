<div align="center">

# ETH / WhatsApp

### Jogos interativos e gerenciamento de grupos em tempo real

**Bot para grupos do WhatsApp • Dashboard online e local • Extensão do Chrome • Configuração por grupo**

![Node.js](https://img.shields.io/badge/Node.js-24-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Chrome](https://img.shields.io/badge/Chrome-Side%20Panel-4285F4?logo=googlechrome&logoColor=white)
![License](https://img.shields.io/badge/licen%C3%A7a-n%C3%A3o%20definida-lightgrey)

</div>

> [!IMPORTANT]
> Projeto independente, não oficial e em desenvolvimento. Não é afiliado à Meta ou ao WhatsApp. Use somente contas e grupos que você tenha permissão para administrar. Não há promessa de disponibilidade permanente nem de aprovação pela plataforma.

## Visão geral

O **ETH / WhatsApp** oferece minijogos em grupos com sessões independentes, processamento serializado de respostas e administração por um painel local. O painel permite acompanhar a conexão, autorizar grupos, consultar conversas observadas e alterar preferências usando modais. A extensão do Chrome abre uma versão compacta no painel lateral do navegador, conectada ao servidor online no Render ou ao monitor local.

## Funcionalidades

| Área | Recursos |
| --- | --- |
| **Jogos** | Quiz, número secreto, palavra embaralhada, adivinhação por emojis e forca |
| **Grupos** | Lista de grupos, autorização por grupo, modalidades e tempos personalizados |
| **Partidas** | Uma sessão por grupo; um vencedor por rodada; intervalos e cooldowns |
| **Administração** | Comandos restritos ao proprietário configurado, não a qualquer administrador |
| **Dashboard** | Conexão, conversas locais, envio manual, indicadores e eventos |
| **Extensão** | Painel lateral do Chrome com modos online (Render) e local; vínculo por código sem ocupar outra vaga |
| **UX** | Controles em modais, navegação de volta, status e convite de reconexão |

## Arquitetura

```text
WhatsApp (Baileys, conexão não oficial)
           |
       Bot Node.js
       |       |
  GameManager  Painel interno (protegido)
       |       |
 Fila por grupo | 
       |    Monitor local (127.0.0.1:3100)
       |       |                |
 Configurações Dashboard     Extensão Chrome
  em arquivo   no navegador   (side panel)
```

O motor de jogos é isolado da integração de transporte. Cada grupo tem sua própria fila e estado de partida. Configurações ficam em arquivos locais; **não é necessário banco de dados neste MVP**.

## Requisitos

- **Node.js 24** e npm
- Google Chrome 116+ para a extensão
- Conta WhatsApp com permissão para os grupos
- Computador ligado enquanto o bot estiver ativo

## Instalação

```powershell
git clone https://github.com/ThzEverton/eth-whatsapp-bot.git
cd eth-whatsapp-bot
npm.cmd ci
Copy-Item .env.example .env
```

Edite o arquivo `.env` para definir o proprietário. Nunca publique credenciais, tokens, QR codes ou pastas de sessão.

```dotenv
OWNER_JID=5511999999999@s.whatsapp.net
ALLOWED_GROUP_IDS=
AUTH_DIR=./auth
CONFIG_FILE=./runtime/config.json
LOG_LEVEL=info
```

O exemplo `OWNER_JID` é ilustrativo. Use seu identificador correto e validado.

### Iniciar a aplicação

```powershell
npm.cmd run build
npm.cmd run app
```

Abra **http://localhost:3100**. Conecte a conta usando o QR quando solicitado e autorize os grupos desejados. Os dados e a autenticação ficam no computador local.

### Extensão do Chrome — online ou local

**Modo online (sem Node.js no computador):** abra [o painel web](https://eth-whatsapp-bot.onrender.com/), entre em **Configurações gerais → Adicionar ao Google Chrome**, baixe e extraia o ZIP e instale a pasta `extension` em `chrome://extensions` com o Modo do desenvolvedor. No site, gere um código temporário de vinculação e cole-o na extensão. Ela usará **a mesma instalação do painel web, sem ocupar uma segunda vaga**.

**Modo local:** na extensão, selecione **Painel local** e execute `npm.cmd run app` no computador para usar `http://localhost:3100`.

A extensão ainda não foi publicada na Chrome Web Store. No Render gratuito as sessões de demonstração podem ser apagadas após reinícios ou novos deploys; nesse caso, reconecte a conta e vincule a extensão novamente.

## Comandos de jogos

| Comando | O que faz |
| --- | --- |
| `/bot` | Apresentação e informações do bot |
| `/jogo` | Abre a seleção de modalidades |
| `/jogo quiz` | Quiz com alternativas |
| `/jogo numero` | Adivinhar número |
| `/jogo palavra` | Palavra embaralhada |
| `/jogo emoji` | Desafio de emojis |
| `/jogo forca` | Jogo da forca |
| `/r C` | Responde à rodada, quando aplicável |
| `/config` | Menu exclusivo do proprietário |

O primeiro acerto **processado na fila** é considerado vencedor; isso não equivale necessariamente à ordem em que os participantes digitam no celular. Outros detalhes e limites estão no código e nas configurações.

## Segurança e privacidade

- O acesso administrativo usa um identificador de proprietário validado.
- Grupos precisam ser autorizados para executar jogos.
- O monitor escuta apenas no endereço local (loopback).
- `.env`, `auth/`, `auth.*/`, `runtime/` e logs ficam fora do Git.
- O histórico local de mensagens é limitado; desconectar não apaga automaticamente dados, backups ou mensagens no WhatsApp.
- Não exponha a porta 3100 na internet sem implantar autenticação, TLS e controles apropriados.
- A biblioteca Baileys **não é uma integração oficial do WhatsApp**.

Leia `LEGAL_SETUP.md` e os documentos de privacidade e termos em `monitor/legal-documents.json` antes de disponibilizar o sistema a terceiros. É necessário identificar o responsável pelo tratamento e oferecer contato real para solicitações.

## Scripts

```powershell
npm.cmd run check  # Verificação de tipos
npm.cmd test       # Suíte automatizada
npm.cmd run build  # Compila e valida arquivos do painel
npm.cmd run app    # Inicializa aplicação e monitor
```

## Organização

```text
src/
  bot/          # Integração, painel interno e roteamento
  games/        # Jogos, sessões e gerenciador
  services/     # Fila, validação, permissões e cooldown
  config/       # Configurações
  data/         # Perguntas, emojis e variações
  tests/        # Testes automatizados
monitor/        # Dashboard, servidor local e documentos
extension/      # Chrome Manifest V3 e side panel
LEGAL_SETUP.md  # Checklist de privacidade para distribuição
```

## Próximas melhorias

- Fluxo de cadastro de perfis com armazenamento adequado
- Estatísticas por grupo, conforme necessidade
- Testes visuais e de ponta a ponta no Chrome
- Refinamento de políticas e canais de suporte antes de distribuição comercial

---

<div align="center">

Desenvolvido por **ETH Tecnologia** · [GitHub de ThzEverton](https://github.com/ThzEverton)

</div>
