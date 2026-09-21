# Convites e acesso por e-mail

Atualização de 21/09/2026. Aplicativo: https://allcablingtechcorp-coder.github.io/D2-MAP-CRM/

O histórico abaixo descreve o envio nativo já validado. A implementação do remetente próprio e do convite com logos está documentada em [E-mails com marca D2](EMAILS-COM-MARCA-D2.md); sua ativação depende da configuração segura da caixa de envio.

## O que mudou

Anteriormente, criar um convite apenas gravava a autorização no CRM. Não havia envio automático de e-mail. Esta versão envia um link de entrada pelo Firebase Authentication e oferece acesso com qualquer endereço de e-mail, sem exigir conta Google. O login Google continua disponível.

A autorização da empresa permanece separada da autenticação: provar que controla um e-mail não concede acesso a outra empresa nem libera módulos adicionais. O super admin define empresas, cargo, escopo e módulos.

## Criar e aceitar

1. Em Administration → Invitations → New invitation, informe o endereço que a pessoa realmente usa.
2. Marque D2 Smart Home, D2 HVAC Solutions ou ambas.
3. Defina cargo, escopo e módulos. Para administrar toda a HVAC, selecione somente HVAC, Operations administrator e Entire organization. Esse escopo corresponde às empresas selecionadas.
4. Crie o convite. A lista mostra o resultado da tentativa de envio.
5. O destinatário abre o link recebido, confirma o mesmo endereço e entra no CRM. No primeiro acesso, clica em Accept invitation para ativar as permissões.

O link pode ser aberto em outro dispositivo: nesse caso, informe o endereço que recebeu a mensagem. O endereço não é incluído como parâmetro de autenticação no URL do CRM. Após concluir a entrada, o aplicativo remove os parâmetros do link da barra de endereços.

Para acessos posteriores, a tela inicial permite solicitar outro link. O sistema envia somente para quem tem convite válido ou acesso central ativo. A resposta pública não informa se um endereço está cadastrado.

## Reenviar, renovar e excluir

| Ação | Resultado |
|---|---|
| Resend email / Reenviar e-mail | Envia outro link; mantém empresas, permissões e prazo do convite. |
| Renew / edit / Renovar / editar | Permite revisar empresas, cargo, escopo e módulos; inicia novo prazo de sete dias e envia novo e-mail. |
| Delete / Excluir | Remove o convite da lista e impede sua aceitação. Mantém o histórico de auditoria. Não exclui identidade, usuário ou carteira comercial. |

Convites aceitos não podem ser renovados. Sua exclusão da lista não revoga o usuário. Para bloquear um usuário existente, altere seu status ou suas empresas na administração.

Um convite antigo sem empresas precisa de seleção explícita ao renovar. Se já houver outro convite ativo para o mesmo endereço, use o convite ativo; não é permitido criar duas autorizações pendentes concorrentes.

## Status e prazos

- **Pending:** ainda pode ser aceito dentro do prazo.
- **Accepted:** a pessoa aceitou; a validade de sete dias não cancela seu acesso.
- **Expired:** o prazo de aceitação terminou.
- **Select companies to renew:** convite legado sem empresas definidas.
- **Not sent:** nenhuma tentativa de envio registrada nesta versão.
- **Accepted by email service:** o Firebase aceitou a solicitação de envio. Não é confirmação de chegada à caixa de entrada ou leitura.
- **Sending failed:** a tentativa falhou; o convite continua registrado e pode ser reenviado.

O convite e o link de autenticação têm ciclos de validade distintos. Se o link deixar de funcionar, solicite outro na tela de entrada ou use Reenviar. Renovar o convite só é necessário para reiniciar o prazo de aceitação ou mudar suas permissões.

Verifique spam e filtros corporativos. O remetente é o serviço padrão do Firebase do projeto D2 MAP CRM; esta versão não usa SMTP do Outlook nem envia pela conta pessoal do administrador. Não há rastreamento de abertura ou confirmação de entrega no destinatário.

## Proteções implementadas

- Gerenciamento de convites restrito ao proprietário ativo da D2 Group com permissão administrativa.
- Verificação de e-mail exigida na aceitação, por Google ou Firebase email link.
- Validação de empresas e permissões no servidor, transações para evitar convites concorrentes e verificação da autoridade do emissor.
- Exclusão e renovação auditadas; histórico do convite permanece armazenado. A exclusão exibida no CRM é lógica, não uma purga de dados.
- Intervalo mínimo de um minuto e limite de dez tentativas de envio por convite/dia.
- Solicitação pública limitada a cinco tentativas por endereço/hora e vinte por IP/hora, com App Check.
- Nenhum link de autenticação ou senha SMTP é persistido no Firestore.
- Conta de serviço existente recebe somente a permissão adicional `firebaseauth.users.sendEmail`, por papel personalizado `d2CrmEmailSender`.
- Provedor Email do Firebase habilitado com acesso por link; configuração Google e domínios autorizados preservados.

## Implementação e operação

- `emailDelivery.ts`: envio via Identity Toolkit `projects.accounts.sendOobCode`, `EMAIL_SIGNIN`, continuação fixa no endereço oficial do CRM.
- `invitationLifecycle.ts`: envio com status persistido; callable `manageInvitation` para reenviar, renovar e excluir; `requestEmailAccess` para solicitar link na tela de entrada.
- `EmailAccess.tsx`: pedido e conclusão do login, em inglês, português e espanhol.
- `InvitationList.tsx`: cartões com logos, empresas, cargo, escopo, validade, status de envio e ações, adaptados a telas pequenas.
- Os convites anteriores não eram e-mails enviados. Eles precisam de Reenviar; renovar apenas quando prazo ou permissões precisarem mudar.

## Validação

- 62 testes existentes do frontend e compilação de produção.
- 21 testes de políticas do backend e compilação TypeScript.
- 33 testes de integração: 26 existentes, seis do ciclo de convites e um de autenticação por e-mail no emulador. Inclui a ausência de data de envio para convites nunca enviados.
- O teste de autenticação verifica um endereço fora do Google, rejeita endereço divergente e rejeita reutilização do link. O emulador não valida entrega de e-mail real nem o redirecionamento hospedado de produção.
- Os testes do ciclo verificam envio/falha/reenvio, concorrência, exclusão, auditoria, renovação, preservação do usuário já aceito, isolamento de empresas e limites da solicitação pública.

Referências oficiais: [Firebase email link](https://firebase.google.com/docs/auth/web/email-link-auth), [Identity Platform sendOobCode](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/projects.accounts/sendOobCode).

## Conferência em produção

A publicação inicial desta atualização ocorreu pelo PR #14, com validação e deploy concluídos. Os três convites pendentes foram reenviados pelo próprio painel; o serviço aceitou os envios. O proprietário confirmou o recebimento da mensagem na pasta de spam de sua caixa corporativa. Os demais recebimentos ainda não foram confirmados pelos destinatários. Os endereços e permissões individuais permanecem no painel administrativo, sem publicação nesta documentação.

Na conferência visual, foi corrigida uma data artificial em convites legados sem tentativa de envio. A confirmação de exclusão apresenta o endereço e o efeito da operação; nenhum convite real foi excluído durante a validação.

O proprietário também confirmou a entrada pelo link na caixa corporativa e a aceitação do convite. A captura fornecida mostra a sessão com perfil Operations administrator na D2 Smart Home. Assim, envio, autenticação sem conta Google e ativação do acesso foram verificados também no fluxo real, além do emulador.
