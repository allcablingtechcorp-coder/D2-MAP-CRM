# Entrega operacional do D2 CRM — 20/09/2026

Este documento acompanha a conclusão dos itens da auditoria anterior. O registro histórico `AUDITORIA_FINAL_2026-09-20.md` descreve a versão anterior; consultar este documento para o estado mais recente.

## Aplicação e fluxo diário

Endereço: https://allcablingtechcorp-coder.github.io/D2-MAP-CRM/

1. Entrar com a conta Google autorizada. O proprietário protegido é `allcablingtechcorp@gmail.com`.
2. Usar Prospecção para pesquisar empresas no Google Maps, explorar o mapa e adicionar leads.
3. Qualificar leads, cadastrar empresas e contatos, programar atividades e criar oportunidades no pipeline.
4. Usar **Gerenciar registros / Manage records / Gestionar registros** em Leads, Pipeline, Atividades e Empresas para editar dados existentes, consultar histórico e arquivar/restaurar registros. Em Empresas, o seletor alterna empresas e contatos.
5. Informar o motivo de cada manutenção. Se outro usuário tiver alterado o registro, recarregar os dados antes de salvar: a versão anterior é rejeitada pelo servidor.
6. Consultar os relatórios e exportações autorizados. Registros arquivados saem das listas e indicadores ativos. Os logos originais permanecem na interface e nos relatórios.

Inglês é o idioma inicial. Português e espanhol permanecem disponíveis com bandeiras. A seleção continua gravada no navegador e agora também na preferência da conta autenticada no Firebase. Se a sincronização falhar, a interface informa o erro; a preferência local continua válida.

## Manutenção comercial entregue

| Operação | Comportamento |
|---|---|
| Editar | Campos permitidos por tipo, validação no servidor, motivo obrigatório e histórico |
| Arquivar | Preserva o documento e o histórico; remove o registro dos indicadores ativos |
| Restaurar | Recupera o registro; exige empresa vinculada ativa, quando aplicável |
| Reatribuir | Administradores/gestores autorizados escolhem responsável e equipe; servidor valida ambos os escopos |
| Reabrir negócio | Apenas perfil autorizado, com motivo; negócio encerrado retorna a Descoberta |
| Concluir atividade | Preserva seu conteúdo; registrar nova interação para complementar uma atividade concluída |
| Consultar histórico | Eventos por registro e auditoria administrativa, com identidade e data |

Empresas são vinculadas por `companyId`; nomes iguais não identificam a mesma empresa. O adaptador atualiza nomes exibidos a partir do cadastro vinculado. Cadastros antigos sem ID precisam de vinculação explícita quando não há correspondência única. A base comercial real estava vazia na validação anterior; dados demonstrativos não foram migrados para produção.

Atribuições são por registro: alterar o responsável de uma empresa não transfere automaticamente todos os contatos, leads, atividades e negócios. Transferir também os registros necessários e garantir que o destinatário possa consultar a empresa vinculada. Isso evita transferências implícitas de dados fora da carteira escolhida.

A escolha de equipe aparece nos novos cadastros. Contatos herdam a atribuição da empresa. As transações mantêm criador, autor da alteração e versão de concorrência.

## Administração e acesso

Papéis implementados: proprietário, administrador operacional, gestor comercial, vendedor, SDR e leitor. A combinação de papel, módulos, escopo e bloqueios explícitos determina as operações permitidas. Escopos: organização, equipes atribuídas ou registros atribuídos. O escopo personalizado sem implementação é recusado, não convertido em acesso irrestrito.

Criar primeiro as equipes, depois registrar o convite com e-mail Google, papel, módulos e escopo necessários. O usuário aceita com a conta correspondente. O convite expira em sete dias. **O sistema não envia o convite por e-mail automaticamente**; comunicar o endereço do aplicativo ao destinatário pelo canal utilizado pela empresa.

Suspender/revogar um membro impede chamadas comerciais. A conta proprietária não pode ser rebaixada ou suspensa pelos controles comuns. Alterações de acesso exigem justificativa e geram auditoria. As escritas comerciais diretas do navegador no Firestore permanecem proibidas; passam pelas Functions.

## Escala e proteção de consumo

- Consulta comercial em páginas de 200 registros, com cursor e filtro de escopo antes da leitura; sem truncamento silencioso em 500 registros.
- Histórico em páginas de 100 eventos; convites e equipes em páginas de 200; a interface acumula páginas autorizadas para os indicadores.
- Manutenção exibe 25 registros por página. Grandes volumes ainda exigem memória no navegador: agregações analíticas no servidor são evolução futura, não capacidade ilimitada prometida.
- Limite de 360 chamadas autenticadas por usuário/minuto, compartilhado entre as Functions; máximo de três instâncias por função. Excedido o limite, aguardar um minuto.
- Chave dedicada do Google Maps restrita ao domínio `allcablingtechcorp-coder.github.io` e às APIs Maps JavaScript, Places e Geocoding. A chave genérica anterior foi preservada para não interromper outros aplicativos.
- App Check com reCAPTCHA Enterprise registrado para o aplicativo web. A exigência no backend será registrada na evidência de publicação após validação de token real.
- Conta de serviço dedicada `d2-crm-runtime`, com `roles/datastore.user` e `roles/logging.logWriter`; as Functions deixam de executar com a conta padrão que tinha Editor. Os papéis da conta antiga não foram alterados, pois outros serviços podem utilizá-la.

O limite por usuário e as restrições de chave reduzem abuso, mas não constituem teto financeiro. Não foi inventado um orçamento mensal nem modificada uma quota global do projeto compartilhado de Maps. Custos dependem do uso de APIs, Firestore, Functions, recuperação e monitoramento.

## Backup, recuperação e alertas

Configuração aplicada ao banco `(default)` do projeto `d2-map-crm`:

- Proteção contra exclusão: ativada.
- Recuperação pontual (PITR): ativada, retenção de sete dias.
- Backup diário: agendado, retenção de 14 dias. Agendamento não é prova de que o primeiro backup diário já terminou.
- Ensaio PITR: snapshot `2026-09-21T00:53:00Z`, restaurado em banco isolado. Comparação concluída às `01:09:50Z`: **8 documentos de origem, 8 restaurados, zero divergências**. A cópia temporária foi removida após verificação, sem excluir documentos do banco principal.
- Logs operacionais: retenção de 30 dias no Cloud Logging. Eventos de auditoria do CRM não possuem expiração automática nesta versão.
- Monitor HTTP do site a cada cinco minutos; alerta de falha persistente e alerta de erros do backend, associados ao e-mail do proprietário. Configuração criada; entrega de mensagem de alerta não foi simulada.

Procedimento de incidente: identificar horário do problema e último deploy; preservar logs; restaurar o instante desejado em banco separado; comparar contagem e conteúdo; somente então planejar substituição dos dados afetados. Nunca restaurar diretamente sobre a base principal sem revisar o alcance. Para falhas de frontend, reverter o commit pela revisão do GitHub e acompanhar o workflow Pages. Para backend, publicar o código compatível com os dados preservados e manter App Check e autorização ativos.

## Validação

Validação local: 53 testes frontend, 21 testes de políticas, 17 cenários transacionais no emulador e 10 testes de regras. Build TypeScript e Vite aprovados. O workflow executa novamente as suítes em Node 22 antes da publicação.

Os testes incluem edição concorrente, bloqueio de outros vendedores/equipes, motivos, arquivamento/restauração, reatribuição, reabertura controlada, empresas homônimas e paginação acima de 500 registros. A interface local foi exercitada para editar, arquivar e restaurar lead, com contagem ativa alterando de cinco para quatro e novamente cinco.

### Homologação humana que depende das contas da equipe

Ainda é necessário executar com contas reais de vendedor, gestor e leitor: aceitar convite, entrar, criar registro, recarregar, conferir isolamento entre carteiras/equipes, suspender e conferir bloqueio, e exportar apenas quando autorizado. Os testes de emulador cobrem as regras, mas não substituem esse ensaio com as identidades da empresa. Os e-mails foram solicitados; nenhum usuário fictício recebeu acesso em produção.

### Evidência de publicação

A preencher após o workflow e a inspeção online da versão desta entrega. Não confundir compilação ou deploy do backend com a conclusão da publicação frontend.

## Continuidade

Para manutenção comum, usar SOL HIGH. Nenhuma troca de modelo é requisito para abrir ou utilizar o CRM. Uma auditoria adicional com Astra HIGH faz sentido após mudanças relevantes de identidade, permissões ou migração de dados; não garante ausência de erros.
