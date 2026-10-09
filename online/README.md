# ETH / WhatsApp — demonstração online

## Endereços da demonstração

- **Painel online:** https://eth-whatsapp-bot.onrender.com/
- **Gerenciamento das vagas:** https://eth-whatsapp-bot.onrender.com/admin
- **Extensão do Chrome:** https://eth-whatsapp-bot.onrender.com/extension.zip
- **Repositório:** https://github.com/ThzEverton/eth-whatsapp-bot

A Vercel também possui um projeto de encaminhamento para o Render; na configuração atual a página pública da demonstração funciona diretamente pelo endereço do Render.

## Arquitetura atual

O Render executa `node online/render.mjs`, que inicia o servidor de demonstração `online/demo-server.mjs`. O serviço mantém até **cinco instalações independentes** no mesmo servidor; cada instalação recebe um token próprio, diretórios exclusivos e um processo de bot separado. O navegador guarda a chave da instalação no `localStorage` do domínio online.

Não existe conta, login nem banco de dados no MVP. O serviço responde `409` quando as cinco vagas estão ocupadas. A página `/admin` exige `DEMO_ADMIN_SECRET`, configurado apenas nas variáveis de ambiente do Render, para listar e liberar vagas.

**Importante:** o armazenamento do Render gratuito é efêmero, e os dados de instalação e autenticação do WhatsApp podem desaparecer após reinícios/deploys. Cinco processos WhatsApp simultâneos ainda não têm validação operacional completa. Não oferecer como serviço de produção.

## Extensão do Chrome: online e local

A pasta `extension/` contém uma extensão Manifest V3 com painel lateral nativo do Chrome e dois modos:

- **Painel online:** vincula à instalação já criada no Render; nenhuma vaga adicional é consumida.
- **Painel local:** acessa o monitor em `http://localhost:3100/sidebar`, quando iniciado no computador.

No site online, clique em **Configurações gerais → Adicionar ao Google Chrome**. Baixe e extraia `/extension.zip`, ative o Modo do desenvolvedor em `chrome://extensions` e carregue a pasta `extension`. No site, gere um **código temporário** de uso único, válido por cinco minutos. Cole-o na extensão para vincular a mesma sessão.

O servidor guarda o código temporário somente em memória e retorna um token exclusivo para a extensão. Ele é persistido em `chrome.storage.local` e validado antes de abrir o painel online. Ao desvincular, esse token é revogado sem excluir a vaga do navegador.

O painel integrado recebe o token diretamente da extensão por `postMessage`, validando a origem. Por isso, não depende de acesso ao `localStorage` do site dentro do iframe e não cria uma nova vaga ao abrir a extensão. A integração com WhatsApp usa Baileys e não é oficial.

A extensão ainda não está publicada na Chrome Web Store.

## API da demonstração

- `POST /api/demo/create`: reserva uma vaga e retorna a chave principal.
- `GET /api/demo/me`: valida a chave e informa vagas restantes.
- `POST /api/demo/link`: cria código temporário autenticado para vincular a extensão.
- `POST /api/demo/redeem`: troca o código por uma chave vinculada à mesma instalação.
- `POST /api/demo/unlink`: revoga o acesso exclusivo da extensão.
- `GET /api/panel`, `POST /api/action`: API do painel autenticada pela chave da instalação.
- `GET /healthz`: verifica o serviço sem revelar dados pessoais.

A instalação é identificada pelo servidor, não por um ID enviado pelo cliente. Nunca publique chaves de instalação, arquivos de autenticação ou segredos administrativos no GitHub.

## Testes

Na raiz do repositório, com Node.js 24:

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run build
node online/demo-test.mjs
node online/extension-test.mjs
```

Os testes automatizados cobrem capacidade de cinco vagas, concorrência, autorização, código de vinculação de uso único, revogação, pacote ZIP, fluxo de painel online, alternância local e prevenção de segunda vaga. A operação real da extensão instalada no Chrome e cinco conexões WhatsApp simultâneas ainda requerem testes manuais.

## Antes de disponibilizar a terceiros

Migrar as sessões e chaves para armazenamento persistente, aumentar a proteção da administração, limitar o consumo de recursos, implementar recuperação de instalação e revisar privacidade e riscos de suspensão pela plataforma WhatsApp.
