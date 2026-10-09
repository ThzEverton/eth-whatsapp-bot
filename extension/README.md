# Extensão ETH / WhatsApp — painel online e local

A extensão abre o ETH WhatsApp Bot no painel lateral do Google Chrome. Na aba **Painel online**, você não precisa iniciar servidor local. Se quiser, pode voltar ao **Painel local** (localhost).

## Instalar

1. Acesse https://eth-whatsapp-bot.onrender.com na instalação da demonstração que já usa.
2. Em **Configurações gerais → Adicionar ao Google Chrome**, baixe a extensão (`/extension.zip`).
3. Extraia o ZIP. Abra `chrome://extensions`, ative **Modo do desenvolvedor**, escolha **Carregar sem compactação** e selecione a pasta `extension` extraída.
4. No site, clique em **Gerar código para extensão** e copie o código (válido por 5 minutos e de uso único).
5. Clique no ícone ETH / WhatsApp do Chrome, selecione **Painel online**, cole o código e vincule a extensão.

A extensão usa **a mesma instalação e a mesma vaga** que você já tem no site. Nenhuma vaga é criada ao vincular. Pode abrir o painel ao lado do WhatsApp Web ou em outra aba.

## Modo local

Na extensão, clique em **Painel local**. Execute `npm.cmd run app` na pasta do projeto e abra `http://localhost:3100`. A extensão exibe o painel do computador sem precisar de código da demonstração.

## Segurança e limitações

- Ainda não está publicada na Chrome Web Store; a instalação é manual.
- A chave vinculada fica em `chrome.storage.local`, apenas na extensão. O código de vinculação expira após cinco minutos.
- Desvincular revoga o token da extensão, mas a instalação web permanece ativa.
- A demo do Render Free pode perder a sessão após deploy ou reinício. Nesse caso, gere um novo código.
- A integração com WhatsApp via Baileys é não oficial.
