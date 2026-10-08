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
