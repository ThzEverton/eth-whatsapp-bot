# Documentos e preparação para distribuição

O painel oferece Política de Privacidade, Termos de Uso, Cookies e armazenamento e Uso aceitável e segurança. Os textos descrevem esta implementação local e estão em `monitor/legal-content.mjs`. São documentos de versão inicial, com identificação e canal de contato ainda pendentes.

Antes de oferecer o sistema a terceiros:

- Identifique o responsável pelo sistema: nome ou razão social, CPF/CNPJ quando aplicável e endereço/canal de contato público apropriado.
- Defina quem determina o tratamento de dados e quem atua sob suas instruções em cada contexto de instalação.
- Documente finalidades, categorias de titulares, dados, bases legais, compartilhamento e prazos de retenção. O QR e a autorização de um grupo não representam consentimento dos seus participantes.
- Disponibilize canal efetivo de privacidade e suporte, com procedimento de verificação e atendimento de solicitações.
- Estabeleça procedimento para apagar ou limitar dados locais, backups e registros técnicos. O botão Desconectar arquiva a sessão e não elimina o histórico.
- Informe os participantes dos grupos e avalie especialmente grupos com menores ou dados sensíveis.
- Para oferta comercial, defina preço, condições, cancelamento, identificação do fornecedor e suporte antes de contratar. Para hospedagem compartilhada, implemente isolamento de contas, autenticação, transporte seguro e controle de acesso antes de expor o serviço.
- Mantenha procedimento de incidentes e revise os documentos quando mudar coleta, finalidade ou integração.

Não há certificação automática de conformidade pela inclusão desses textos. Os documentos devem ser adequados à operação efetiva.

Fontes: [LGPD](https://planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm) e [ANPD — direitos dos titulares](https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados/direito-dos-titulares).

O comando `npm.cmd run build` sincroniza o tema e os documentos com `monitor/management.js`. Essa rota já é servida pelas versões anteriores do painel, permitindo atualizar a interface com uma recarga da página. Alterações no backend continuam exigindo reinício do processo correspondente.
