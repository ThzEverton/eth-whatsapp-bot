# Deploy online — ETH / WhatsApp

## Arquitetura

- **Vercel:** dashboard estático, login e funções de API protegidas por cookie HttpOnly.
- **Servidor persistente:** processo Node.js do bot e monitor local (127.0.0.1:3100).
- **Gateway:** processo separado, escutando somente 127.0.0.1:3200, autenticação por token compartilhado.
- **Caddy ou proxy equivalente:** HTTPS em domínio do servidor, encaminhando somente /api/* ao gateway.

> Não exponha localhost:3100 na internet. Não publique auth/, runtime/, .env ou logs.
> O serviço utiliza Baileys, biblioteca não oficial. Riscos de restrição de conta e incompatibilidade permanecem.

## 1. Servidor persistente

No VPS com Node 24, clone o repositório, configure .env e rode npm ci / npm run build.
Configure o bot/monitor para iniciar com systemd ou outro supervisor. Garanta **uma única instância** do bot e armazenamento persistente das pastas auth e runtime.

Execute o gateway com:

```bash
BOT_GATEWAY_TOKEN='<token aleatorio forte com no minimo 32 caracteres>' node online/gateway.mjs
```

Guarde o segredo em um arquivo de ambiente com permissões restritas e configure o serviço gateway no supervisor.
Nunca inclua esse token no repositório nem no cliente.

Exemplo de Caddyfile no VPS (substitua pelo domínio verdadeiro):

```caddyfile
bot-api.seudominio.com {
  @api path /api/*
  handle @api {
    reverse_proxy 127.0.0.1:3200
  }
  respond 404
}
```

O proxy deve prover TLS confiável. Configure firewall para permitir apenas HTTPS público, sem abrir as portas 3100 e 3200.

## 2. Vercel

Crie um projeto importando o repositório e defina **Root Directory = online**. Framework: Other. Build: `npm run build`. Pasta de saída: `public`.

Variáveis de ambiente privadas (Production e Preview, se necessário):

| Nome | Descrição |
|---|---|
| `ADMIN_PASSWORD` | Senha longa, única para login administrativo; não exponha no navegador |
| `SESSION_SECRET` | Segredo aleatório de assinatura, pelo menos 32 bytes imprevisíveis |
| `BOT_GATEWAY_URL` | Exemplo: `https://bot-api.seudominio.com` |
| `BOT_GATEWAY_TOKEN` | Mesmo token definido no gateway VPS |

**Proteja contra força bruta:** habilite a proteção de autenticação e regras de rate limit/WAF disponíveis no provedor. A senha sozinha não substitui políticas de acesso, MFA/restrição por IP quando possível e auditoria.

O login oferece sessão de até oito horas com cookie `HttpOnly; Secure; SameSite=Strict`; o navegador não recebe o token do gateway. Rotas `/api/status`, `/api/panel`, `/api/action` e `/api/bot` são encaminhadas pela função da Vercel mediante sessão válida.

## 3. Atualizações do frontend

O comando `node online/build.mjs`, executado na raiz do repositório local, sincroniza os arquivos do dashboard para `online/public`. Commit os arquivos atualizados antes de enviar ao GitHub.

## 4. Testes para liberar acesso real

1. Sem autenticação: `/` deve redirecionar para login; `/api/panel` deve retornar HTTP 401.
2. Senha errada não gera cookie.
3. Com login: o status do bot aparece; grupos e conversas exibem dados reais.
4. Teste iniciar/parar no ambiente de homologação, não na sessão de produção.
5. Teste desconexão/reconexão somente com conta de teste e autorização.
6. Verifique HTTPS, domínio, firewall, rate limit e isolamento do processo.
7. Revise os documentos de privacidade e informe controlador e canal de contato antes do uso com terceiros.

A extensão atual aponta para localhost; não é migrada automaticamente para o domínio remoto. Seu uso remoto requer uma atualização específica do mecanismo de ligação e revisão de permissões do Chrome.

## Render: serviço persistente

O arquivo `render.yaml` da raiz permite iniciar um **Web Service pago** no Render por Blueprint. Ele compila o Node.js e executa `node online/render.mjs`, que mantém o monitor e o gateway em processos separados, no mesmo container.

O serviço disponibiliza apenas o gateway na porta `PORT`; `/healthz` responde à verificação do Render sem expor estado da conta. As rotas de operação exigem `BOT_GATEWAY_TOKEN`. O monitor e o painel interno permanecem acessíveis somente em `127.0.0.1:3100`.

O disco persistente é montado em `/opt/render/project/src/persistent` e armazena `auth/` e `config.json`. Nunca configure duas instâncias compartilhando essa autenticação. O QR de conexão e eventuais ações de sessão exigem supervisão cuidadosa.

### Para conectar com a Vercel

1. Faça o push dos commits ao GitHub.
2. Em [Render](https://dashboard.render.com/), crie um Blueprint usando `render.yaml`. **O plano Starter e o disco têm custo**; confirme o valor antes de aprovar.
3. Informe `OWNER_JID` e gere um `BOT_GATEWAY_TOKEN` longo e aleatório. Armazene somente nas variáveis do Render e da Vercel, nunca no Git.
4. Configure na Vercel `BOT_GATEWAY_URL=https://NOME-DO-SERVICO.onrender.com` e `BOT_GATEWAY_TOKEN` com o mesmo segredo.
5. Configure `ADMIN_PASSWORD` e `SESSION_SECRET` na Vercel. Ative proteção anti-força-bruta no acesso ao painel.
6. Teste com conta WhatsApp de homologação e confirme que a autenticação permanece após um redeploy.

O Render Free não é apropriado para essa instalação com sessão de arquivos, pois hiberna e não permite disco persistente. O uso do Render **não elimina os riscos do Baileys não oficial**.

## Demonstração multiusuário: máximo de 5 contas

A demo aceitará **cinco contas distintas**, cada uma com login, identidade, configurações, histórico e sessão WhatsApp próprios. Quando os slots 1–5 forem ocupados, o cadastro precisa retornar “Vagas da demonstração encerradas”, sem derrubar contas já cadastradas.

O arquivo `online/demo-capacity.sql` prepara a reserva transacional de cinco slots no Supabase (PostgreSQL), com trava contra cadastros concorrentes e RLS. Esse script **ainda não foi aplicado em banco algum**.

**ATENÇÃO: A demo multiusuário ainda não está pronta para uso público.** A versão atual do `online/api/[...path].js` autentica com uma senha administrativa compartilhada e encaminha todas as requisições ao mesmo processo WhatsApp. Não distribua senhas de acesso, não convide usuários e não interprete os cinco slots do SQL como isolamento de sessão pronto.

Próximas etapas obrigatórias antes do convite aos participantes:

1. Substituir a senha compartilhada por login individual e validar o token do usuário em **toda** rota de API.
2. Criar supervisor de até cinco conexões Baileys independentes, com diretórios de autenticação e estado separados por ID interno imutável; nunca confiar em um `userId` enviado pelo cliente.
3. Associar chats, grupos, configurações, logs, comandos e QR code apenas ao usuário autenticado; garantir testes de acesso cruzado (A não lê ou controla B).
4. Persistir as sessões WhatsApp em armazenamento protegido que sobreviva a reinícios; o filesystem efêmero do Render Free não garante isso.
5. Integrar cadastro com `reserve_demo_slot` de maneira server-side, com recuperação de erro de capacidade e políticas de exclusão de dados.
6. Implementar rate limit, controle de custos/recursos e revisão dos termos, políticas e autenticação antes de abrir a demo.

Não basta permitir cinco logins com o backend atual de conta única.
