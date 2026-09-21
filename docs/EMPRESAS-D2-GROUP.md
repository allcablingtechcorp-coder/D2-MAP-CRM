# CRM por empresa — D2 Group

Implementação: 21/09/2026. Empresas operacionais: **D2 Smart Home** e **D2 HVAC Solutions**. A D2 Group permanece como estrutura central de acesso; não é uma terceira carteira comercial.

## Operação

O seletor **Operating company / Empresa em operação / Empresa en operación** aparece abaixo do cabeçalho. O logo e o nome identificam a empresa ativa em todas as áreas. A seleção fica salva neste navegador por usuário. Ao trocar, o aplicativo carrega a carteira e as permissões da nova empresa.

Leads, empresas clientes, contatos, pipeline, atividades, equipes, visitas e histórico são independentes. O mesmo estabelecimento encontrado no Google Maps pode ser prospectado pelas duas empresas; cada uma terá seus próprios registros, responsáveis e visitas.

O idioma continua independente da empresa: inglês como padrão, com português e espanhol disponíveis. A preferência de idioma permanece salva para o usuário.

## Super admin e acessos

A conta protegida `allcablingtechcorp@gmail.com` opera ambas as empresas. Seu acesso de proprietário não pode ser removido pelo painel.

Em **Administration / Administração**:

1. Em **Company access / Acesso por empresa**, os cartões permitem escolher qual empresa configurar.
2. Para um usuário já cadastrado, marque Smart Home, HVAC ou ambas e informe o motivo. Salvar modifica os acessos e registra auditoria. Desmarcar todas remove o acesso às duas carteiras, sem excluir a identidade ou seus registros históricos.
3. Selecione a empresa no cabeçalho e abra **Users / Usuários** para configurar o cargo, os módulos, o escopo e as equipes desse usuário naquela empresa.
4. Repita na outra empresa se a pessoa tiver acesso às duas. Os cargos podem ser diferentes em cada uma.

Somente o super admin central concede empresas e cria convites. Administradores operacionais consultam a administração e os dados permitidos da sua empresa; não podem conceder acesso a outra. Permissões de módulos e escopos continuam aplicáveis além da autorização da empresa.

Exemplos:

| Usuário | Empresas autorizadas | Configuração |
|---|---|---|
| Administrador Smart | Smart Home | Operations administrator; escopo da organização |
| Administrador HVAC | HVAC Solutions | Operations administrator; escopo da organização |
| Administrador de ambas | As duas | Cargo e módulos configurados em cada empresa |
| Vendedor Smart | Smart Home | Sales representative; registros/equipes atribuídos |

Ao conceder uma empresa pela primeira vez a um usuário existente, o sistema usa seu cargo e módulos centrais como ponto de partida, sem copiar equipes de outra empresa. Ao reautorizar uma empresa já existente, preserva a configuração própria dela e reativa o vínculo. Ajustes específicos devem ser feitos em Usuários da empresa selecionada. Uma suspensão central continua bloqueando todas as empresas.

## Convites

O formulário de convite exige selecionar uma ou duas empresas, além do e-mail, cargo, escopo e módulos. A criação envia um link de acesso por e-mail pelo Firebase Authentication. A pessoa pode usar qualquer provedor de e-mail, sem precisar de conta Google ou senha. A entrada com Google continua disponível como alternativa.

O convite vale por sete dias. A aceitação exige e-mail verificado e cria os vínculos selecionados em uma transação. Equipes são configuradas depois, dentro de cada empresa. A configuração inicial de cargo e módulos vale para todas as empresas selecionadas; depois pode ser diferenciada.

Convites antigos sem empresa definida são identificados como **Select companies to renew / Selecione empresas para renovar** e não concedem acesso automaticamente. Devem ser renovados pelo super admin escolhendo explicitamente as empresas. Usuários já cadastrados recebem novas empresas pelo painel de acesso, não por um segundo convite.

O super admin pode **reenviar o e-mail**, **renovar/editar** empresas e permissões, ou **excluir** o convite da lista. A exclusão invalida convites ainda não aceitos e preserva a auditoria. Não revoga o acesso de uma pessoa que já aceitou: nesse caso, use Usuários/Acesso por empresa. Consulte [Convites e acesso por e-mail](CONVITES-E-ACESSO-EMAIL.md) para o procedimento completo.

## Relatórios e logos

Em **Reports / Relatórios**, marque uma ou ambas as empresas. Somente empresas autorizadas com permissão de relatório podem ser selecionadas. O painel mostra indicadores consolidados e os resultados individuais de cada empresa. Se uma fonte falhar, o sistema não apresenta um consolidado parcial como completo.

O PDF usa o logo D2 Group e os logos das empresas selecionadas, preservando suas proporções. A primeira página resume o conjunto selecionado; a segunda separa os totais por empresa. O nome do arquivo identifica as empresas. Na exportação, permissões e dados são consultados novamente. Exportar ambas exige permissão de exportação nas duas.

Os indicadores mantêm a metodologia existente: registros autorizados disponíveis, sem filtro mensal; pipeline somente de oportunidades abertas; taxa de ganho sobre negócios encerrados. Os números podem ser limitados pelo escopo do usuário. O relatório não concede acesso adicional aos dados.

## Estrutura técnica e proteção

- `organizations/d2-group/memberships/{uid}`: vínculo central e lista `companyIds`.
- `organizations/d2-smart-home/...`: dados, membros, equipes e auditoria Smart Home.
- `organizations/d2-hvac-solutions/...`: dados, membros, equipes e auditoria HVAC.
- Cada operação verifica vínculo central ativo, empresa autorizada, vínculo da empresa ativo, cargo, módulos e escopo.
- Chamadas comerciais não operam em `d2-group`.
- Alterações de acesso por empresa usam transação e auditoria. Clientes não podem editar os vínculos diretamente no Firestore.
- Regras de leitura da administração também verificam a autorização central. Um vínculo antigo na empresa não contorna uma revogação central.
- A troca da empresa desmonta a área comercial anterior e carrega a nova; identificadores dos relatórios consolidados incluem a empresa para evitar colisões.
- Logs de autenticação permanecem centrais; o super admin vê a auditoria central junto à da empresa ativa. Administradores locais veem apenas a auditoria local.
- App Check, limites de requisições, conta de serviço, backups e proteção de exclusão existentes permanecem habilitados.

## Ativação e dados anteriores

O inventário de produção imediatamente anterior à preparação encontrou zero leads, empresas clientes, contatos, atividades e oportunidades na organização central. Não houve atribuição presumida ou cópia de carteira comercial. A ativação cria as duas organizações e os vínculos protegidos do proprietário, adicionando as duas empresas ao vínculo central em uma transação com precondição de versão.

Nenhum outro usuário recebe acesso por essa ativação. Os dois convites antigos continuam sujeitos à renovação com seleção de empresas.

## Validação

- 62 testes do frontend: métricas, fluxos, idiomas, relatórios e demais funcionalidades existentes.
- 21 testes de políticas do backend.
- 26 testes de integração no emulador, incluindo empresas independentes, acesso cruzado bloqueado, revogação, suspensão central, convites, criação do primeiro vínculo e visitas ao mesmo estabelecimento em empresas diferentes.
- 11 testes de regras Firestore, incluindo leitura direta cruzada e tentativa de alteração dos próprios acessos.
- Compilações de frontend/backend e inspeção visual em desktop e largura móvel de 390 px.
- PDF de amostra renderizado para verificar logos, proporções e paginação. Os dados da amostra são demonstrativos.

Os testes de escrita e usuários restritos usam o emulador; não criam clientes ou convidados fictícios em produção. A publicação deve ser conferida com a conta proprietária no endereço oficial.

## Manutenção

Para ajustes rotineiros de tela, textos e relatórios, SOL HIGH é adequado. Mudanças futuras na estrutura de autorização devem repetir os testes de isolamento, regras e transações antes da publicação, independentemente do modelo escolhido.
