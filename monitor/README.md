# Painel local e supervisor

Execute `npm.cmd run app` na raiz para compilar e iniciar o sistema em http://localhost:3100. O supervisor inicia o bot quando necess?rio. O comando `npm.cmd run monitor` usa a compila??o j? existente.

O painel exibe o QR, a conex?o, grupos, mensagens observadas, partidas e configura??es individuais. Em **Gerenciar grupo**, autorize um grupo da conta, escolha modalidade e uma das 21 varia??es tem?ticas (ou o cl?ssico), inicie/encerre partidas e salve configura??es. As mudan?as persistem por grupo.

A rota `/sidebar` oferece a interface compacta usada pela [extens?o](../extension/README.md). O servi?o atende apenas em 127.0.0.1; a??es exigem a origem local e o acesso ao processo interno usa uma chave aleat?ria. As credenciais ficam na pasta de autentica??o configurada.

Os controles **Iniciar**, **Parar** e **Reiniciar** gerenciam o processo. Use **Desconectar WhatsApp** para remover o vínculo do aparelho com este sistema e **Conectar WhatsApp** para gerar uma nova conexão por QR.

Uma instala??o corresponde a uma conta WhatsApp. Conversas anteriores ? observa??o do sistema n?o constituem um hist?rico completo do WhatsApp.
