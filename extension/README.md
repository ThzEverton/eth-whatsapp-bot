## Instalar pelo painel

Abra http://localhost:3100 e clique em **Adicionar ao Google Chrome**. Baixe o ZIP, extraia a pasta `extension` e siga os passos exibidos no painel. Esta extensão ainda não está publicada na Chrome Web Store.

## Desconectar e reconectar

Use **Desconectar WhatsApp** para encerrar o vínculo desta conta com o sistema. A sessão local é arquivada. Em seguida, clique em **Conectar WhatsApp** e leia um novo QR.

# ETH ? painel lateral do WhatsApp

1. Na pasta do sistema, execute `npm.cmd run app` (Node.js 24).
2. No Chrome, abra `chrome://extensions`, ative **Modo do desenvolvedor** e clique em **Carregar sem compacta??o**. Selecione esta pasta `extension`.
3. Abra o WhatsApp Web e clique no ?cone **ETH ? Jogos para WhatsApp** na barra de extens?es. O painel abre na lateral nativa do navegador.
4. No celular, abra **Aparelhos conectados ? Conectar aparelho** e leia o QR do painel. A conex?o do sistema ? um aparelho adicional; o WhatsApp Web continua aberto.
5. Escolha qualquer grupo listado, clique em **Autorizar grupo** e selecione modalidade e varia??o. Salve tempos, intervalos e varia??es padr?o em **Gerenciar grupo**.

O servi?o local precisa continuar aberto. O painel tamb?m est? em http://localhost:3100. Se j? houver uma sess?o conectada, o QR n?o aparece novamente. Cada instala??o usa uma conta WhatsApp; o projeto n?o oferece hospedagem simult?nea de contas de v?rios clientes.

A extens?o n?o l? o DOM nem altera o c?digo do WhatsApp. A API lateral segue a [documenta??o oficial do Chrome](https://developer.chrome.com/docs/extensions/reference/api/sidePanel). As ?nicas permiss?es s?o o painel lateral e acesso a WhatsApp Web/servi?o local. A conex?o usa [Baileys](https://github.com/WhiskeySockets/Baileys).

S?o 21 temas em cada um dos cinco jogos, al?m do cl?ssico: Animais, Frutas, Cozinha, Esportes, Espa?o, Natureza, M?sica, Transportes, Profiss?es, Tecnologia, Casa, Escola, Clima, Jardim, Vida marinha, Doces, Aventura, Festas, Roupas, Ferramentas e Lugares. Quiz, palavra, emoji e forca usam conte?do de cada tema; n?mero usa problemas de contagem e opera??es de cada contexto.

Tamb?m pode iniciar pelo grupo: `/jogo quiz espaco`, `/jogo forca animais` ou `/jogo numero escola`. A varia??o passada no comando ou no seletor de partida vale apenas para essa rodada. A varia??o padr?o salva vale para `/jogo modalidade` sem tema.
