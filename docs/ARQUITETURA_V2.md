# Arquitetura inicial — D2 CRM V2

## Objetivo desta entrega

Esta fundação converte a navegação centrada no mapa em um workspace comercial com módulos próprios para dashboard, leads, pipeline, atividades, prospecção geográfica, empresas, relatórios e administração.

A V2 está isolada em `v2/`. A aplicação publicada permanece intacta enquanto autenticação, banco, regras e migração não forem validados.

## Camadas atuais

| Camada | Local | Responsabilidade |
|---|---|---|
| Interface | `v2/src/App.tsx` | Páginas e fluxos navegáveis do protótipo |
| Shell e navegação | `v2/src/components/AppShell.tsx` | Sidebar, topo, contexto de conta e estrutura comum |
| Domínio comercial | `v2/src/domain/crm.ts` | Tipos de lead, oportunidade e atividade |
| Autorização | `v2/src/domain/access.ts` | Papéis, permissões, escopos e proteção do proprietário |
| Fixtures | `v2/src/data/demo.ts` | Dados exclusivamente demonstrativos |
| Sistema visual | `v2/src/styles.css` | Tokens, componentes, layouts e breakpoints responsivos |
| Identidade | `v2/src/components/Brand.tsx` | Uso consistente do logo oficial em telas e relatórios |
| Exportação | `v2/src/lib/exportExecutiveReport.ts` | Relatório executivo em PDF com marca, métricas e metadados |
| Internacionalização | `v2/src/i18n/` | Catálogos PT/EN/ES, formatos locais e preferência persistente |

## Modelo de autorização proposto

Papéis disponíveis:

1. `owner`: proprietário protegido e acesso completo.
2. `operations_admin`: operação, auditoria e relatórios, sem poder transferir a propriedade.
3. `sales_manager`: visão da equipe, distribuição e gestão comercial.
4. `sales_rep`: carteira e registros atribuídos.
5. `sdr`: prospecção, qualificação e atividades.
6. `viewer`: leitura e análise.

O acesso efetivo é calculado por quatro dimensões: estado da associação, papel, escopo de dados e módulos habilitados. Exceções explícitas podem conceder ou remover uma permissão. Uma associação suspensa não possui acesso, independentemente do papel.

A conta `allcablingtechcorp@gmail.com` está representada no protótipo como `ownerProtected`. Essa definição ainda não é persistida nem aplicada ao ambiente de produção.

## Decisões de segurança

- Nenhuma regra do Firestore foi criada sem identificar previamente a edição do banco.
- Nenhuma credencial, usuário ou dado de produção foi modificado.
- A interface de administração apresenta um resumo antes da alteração; o backend futuro deverá exigir confirmação, autorização no servidor e evento de auditoria.
- Dados demonstrativos são identificados no topo da aplicação e não podem ser confundidos com dados reais.
- O logo oficial presente no repositório é usado por um componente único e incorporado ao PDF; o relatório não depende de imagens externas.
- Interface e PDF compartilham os mesmos catálogos em português, inglês e espanhol. A preferência é mantida em `localStorage` e atualiza o atributo `lang` do documento.
- A integração real com Google Maps será conectada após autenticação, segregação por organização e políticas de uso estarem ativas.

## Próxima arquitetura técnica

1. Confirmar projeto, edição e região do Firestore com uma conta autorizada.
2. Implementar Firebase Authentication e documento de associação por organização.
3. Criar regras do Firestore com negação por padrão, validação de campos e escopo por equipe ou responsável.
4. Criar trilha de auditoria somente por backend para login, consulta, criação, atualização, exportação e mudanças administrativas.
5. Substituir fixtures por repositórios tipados sem alterar as páginas.
6. Migrar pesquisa, locais salvos e supressões da aplicação atual.
7. Executar testes de regras com Emulator Suite antes do primeiro deploy V2.

## Critério de ativação

A V2 só deve substituir a versão atual quando autenticação, regras de acesso, auditoria, migração e regressão do mapa estiverem aprovadas em ambiente de homologação. O retorno para a aplicação atual deve permanecer possível durante a primeira janela de produção.
