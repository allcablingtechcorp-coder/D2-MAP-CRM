# Autenticação e governança — contrato do CRM V2

## Objetivo

Esta camada define como uma identidade autenticada passa a ter acesso ao CRM, como o proprietário administra usuários e como cada ação administrativa gera evidência de auditoria. O runtime Firebase está implementado, mas permanece desativado; os dados comerciais e a administração continuam em memória no modo demonstrativo.

## Resolução da sessão

O arquivo `v2/src/application/session.ts` separa autenticação de autorização. O provedor de identidade confirma quem é o usuário; a associação confirma o que ele pode acessar.

| Estado | Condição | Comportamento esperado |
|---|---|---|
| `signed_out` | Nenhuma identidade autenticada | Exibir entrada com Google |
| `membership_required` | Identidade válida sem associação | Bloquear o workspace e orientar contato com o administrador |
| `access_blocked` | Associação convidada, suspensa ou revogada | Bloquear módulos e informar o estado do acesso |
| `authenticated` | Identidade e associação ativa | Liberar somente módulos e dados do escopo atribuído |

`AuthGateway` e `MembershipRepository` são portas tipadas. Os adaptadores Firebase implementam essas portas sem incluir chamadas do SDK nas páginas do produto. A aplicação continua em modo demonstrativo até a validação do backend e das regras.

## Invariantes administrativas

1. `allcablingtechcorp@gmail.com` é o proprietário protegido.
2. O proprietário protegido não pode ter papel, status, escopo ou módulos alterados, inclusive pela própria sessão.
3. Somente uma associação `owner` ativa pode gerenciar associações comuns.
4. Toda alteração exige uma justificativa não vazia antes da confirmação.
5. A revisão preserva valores anteriores, novos valores e os campos modificados.
6. O papel `owner` não pode ser concedido por convite; transferência de propriedade exige um fluxo separado.
7. Convites usam e-mail normalizado, rejeitam duplicidade e expiram após sete dias.
8. Uma organização nunca pode ficar sem ao menos um proprietário ativo.

## Eventos de auditoria

O contrato `AuditEvent` registra:

- organização;
- ação;
- ator e e-mail normalizado;
- tipo e identificador do alvo;
- data e hora;
- resumo;
- justificativa, quando aplicável;
- alterações com valor anterior e novo.

A lista inicial de ações cobre login, acesso negado, convite, alteração, suspensão, revogação e exportação de relatório. Tokens, credenciais e snapshots completos de documentos não fazem parte do evento.

Em produção, eventos administrativos devem ser gravados por código confiável no backend. O cliente pode solicitar uma alteração, mas não deve conseguir criar ou modificar diretamente a trilha de auditoria.

## Fluxos implementados na interface

### Usuários

- seleção da associação;
- visualização de papel, status, escopo e módulos;
- bloqueio visual e funcional da conta proprietária;
- motivo obrigatório;
- revisão explícita antes da confirmação;
- aplicação em memória e geração de evento de auditoria.

### Convites

- e-mail, papel e escopo;
- validação de formato e duplicidade;
- exclusão do papel proprietário;
- expiração calculada em sete dias;
- registro do evento na auditoria.

### Auditoria

- lista ordenada do evento mais recente para o mais antigo;
- ator, alvo, horário e justificativa;
- tradução em português, inglês e espanhol.

## Persistência futura

Coleções propostas, sujeitas à confirmação da edição e da região do Firestore:

```text
organizations/{organizationId}
organizations/{organizationId}/memberships/{uid}
organizations/{organizationId}/invitations/{invitationId}
organizations/{organizationId}/auditEvents/{eventId}
```

A ativação requer, nesta ordem:

1. confirmar edição, região e projeto Firebase com uma conta autorizada;
2. implementar a função `saveMembership` e demais comandos administrativos em backend confiável;
3. escrever regras com negação por padrão e validação de campos;
4. testar autenticação, papéis, escopos, convites e auditoria no Emulator Suite;
5. migrar os usuários legados e eliminar o booleano `super_admin` somente após reconciliação;
7. validar em homologação antes de qualquer publicação.

## Testes automatizados

Os testes cobrem negação por associação suspensa, permissões por papel, proprietário imutável, motivo obrigatório, revisão antes/depois, normalização e expiração de convite, duplicidade, proibição de convite proprietário, normalização de auditoria e os quatro resultados de resolução de sessão.
