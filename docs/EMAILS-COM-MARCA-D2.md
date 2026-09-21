# Convites com identidade D2 Group

## Implementação

O envio personalizado usa a caixa `support@d2smarthome.com`, hospedada na Hostinger e verificada como ativa no painel. O nome exibido é **D2 Group**. As respostas voltam à mesma caixa.

O convite contém logo D2 Group, mensagem de boas-vindas, logos apenas das empresas autorizadas, função, escopo, prazo do convite e botão para aceitar. A mensagem de acesso posterior usa texto próprio de retorno ao CRM. Há versões em inglês, português e espanhol; inglês é o padrão. Convites sem idioma gravado usam inglês; pedidos de acesso usam o idioma escolhido na tela de entrada.

Os logos são incorporados como imagens CID. Há também uma versão em texto simples. O HTML usa tabelas e estilos compatíveis com clientes de e-mail, largura limitada no computador e adaptação para celular. As prévias estão em `docs/email-preview/`; seus links são demonstrativos, sem credenciais.

## Autenticação e envio

1. O servidor valida convite ou usuário, empresas e limites de envio.
2. O Firebase gera o link de autenticação com `returnOobLink: true`, sem enviar uma segunda mensagem padrão.
3. O servidor insere esse link no modelo e envia pela Hostinger usando SMTP com TLS na porta 465.
4. O CRM registra aceitação ou falha do serviço de e-mail. Aceitação SMTP não significa entrega na caixa de entrada ou leitura.
5. A autenticação e a aceitação do convite continuam submetidas às mesmas verificações do CRM. O envio não altera permissões.

## Segredo e ativação

- Segredo: `CRM_SMTP_PASSWORD`, projeto `d2-map-crm`, Google Secret Manager.
- O proprietário insere a senha diretamente no console. Não salvar em arquivos, Git, Firestore, chat ou logs.
- A conta de execução `d2-crm-runtime@d2-map-crm.iam.gserviceaccount.com` tem leitura somente nesse segredo.
- Somente `createGovernanceInvitation`, `manageInvitation` e `requestEmailAccess` vinculam o segredo quando `CRM_EMAIL_PROVIDER=hostinger`.
- `CRM_EMAIL_PROVIDER=hostinger` deve constar no ambiente de produção e no ambiente usado para gerar um manifesto de funções manualmente. Nunca colocar a senha no manifesto.
- A configuração padrão continua sendo o envio nativo do Firebase. Ao habilitar Hostinger, senha ausente ou falha SMTP resulta em falha de envio, sem troca silenciosa de remetente.
- Após salvar uma versão habilitada, publicar as três funções e verificar uma mensagem real antes de considerar a ativação concluída.

## Operação

Para trocar a senha: o responsável atualiza a caixa na Hostinger, cadastra a nova versão no Secret Manager e republica as três funções para vincularem a versão atual. Versões antigas só devem ser desabilitadas após a confirmação do novo envio.

Para retornar temporariamente ao envio nativo: remover `CRM_EMAIL_PROVIDER=hostinger` da configuração, gerar novamente o manifesto sem essa variável e republicar as três funções. Isso preserva os convites, os usuários e as permissões.

Não registrar respostas SMTP completas nem links de autenticação em logs. Não alterar registros MX para ativar esta integração. Classificação de spam depende também do serviço destinatário; um resultado SMTP positivo não garante posicionamento na caixa de entrada.

## Validação

Os testes cobrem textos e logos por empresa/idioma, escape de HTML, restrição de destinos do link, seleção de provedor sem duplicidade de e-mail, ausência de senha, remetente fixo, TLS, imagens incorporadas e rejeição de destinatário. Os testes de integração exercitam o ciclo de convite e a autenticação existente nos emuladores.

A prévia foi conferida em navegador em larguras de computador e celular. Isso não substitui a conferência final em Outlook/Gmail de uma mensagem recebida. A ativação de produção e a entrega real devem ser registradas após a configuração da senha.

Referências: [Firebase — gerar links para envio próprio](https://firebase.google.com/docs/auth/admin/email-action-links), [Identity Platform — sendOobCode](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/projects.accounts/sendOobCode), [Hostinger — configuração de e-mail](https://www.hostinger.com/support/1575756-how-to-get-email-account-configuration-details-for-hostinger-email/).
