# Correções de usabilidade e prospecção — 20/09/2026

## Problemas tratados

As capturas enviadas pelo usuário mostraram problemas que os testes anteriores de regras e operações não cobriam: texto pequeno no celular, cartão fixo sobre o mapa, identidade visual desproporcional, rodapé da navegação cortado e mensagens técnicas desnecessárias. Esta revisão inclui verificação visual e execução do fluxo de visitas, além dos testes automatizados.

## Experiência de prospecção

1. Pesquisar tipo/nome de empresa e localidade no Google Maps real. A busca começa por ação do usuário; abrir a página não dispara pesquisa de estabelecimentos.
2. Alternar entre mapa e lista no celular. No desktop, as duas visualizações aparecem lado a lado.
3. Após a busca, o formulário é recolhido. “Edit search / Alterar busca / Editar búsqueda” permite modificá-lo.
4. Selecionar um marcador ou uma empresa abre os detalhes **fora da superfície do mapa**. O painel não abre automaticamente com o primeiro resultado. É possível fechá-lo ou usar “Voltar ao mapa”.
5. Salvar o lead, agendar uma visita, registrar uma visita realizada ou abrir as direções no Google Maps.
6. Uma visita pode criar o lead e a empresa no mesmo salvamento; não exige cadastrar os três separadamente.
7. Consultar o histórico com data/hora, responsável/visitante e anotações. A conclusão de uma visita agendada atualiza o registro existente.
8. Consultar “Meus locais salvos” e filtrar o mapa por Novo, Lead salvo, A visitar ou Visitado. Uma revisita pendente tem prioridade no status; as visitas anteriores continuam no histórico.

Os marcadores usam cinza, azul, âmbar e verde, acompanhados por status textual na lista e nos detalhes. Zoom, satélite, tela cheia e Street View continuam sendo controles do Google Maps. O botão “Carregar mais resultados” está na lista quando o Google disponibiliza outra página.

## Persistência e autorização

- Nova callable `saveProspectingVisit`, protegida por autenticação, App Check, limite de requisições, associação ativa, módulo de prospecção, permissões e escopo de carteira/equipe.
- Transação única para empresa, lead, visita, vínculo do Google Place ID e eventos de histórico/auditoria.
- Identificador de operação permite repetir uma solicitação sem duplicar lead/visita. Chamadas concorrentes são testadas.
- A identidade de quem conclui a visita vem da associação autenticada no servidor. O cliente não pode informar outro visitante.
- A visita mantém a carteira do lead. Quando um gestor registra uma visita para um lead de vendedor, o vendedor continua vendo esse histórico; o campo de visitante identifica o gestor separadamente.
- Conclusão futura, outro Google Place ID para lead já vinculado, registro arquivado, usuário suspenso e tentativa de acesso fora do escopo são recusados.
- Não há liberação de escrita direta no Firestore. As novas coleções auxiliares continuam inacessíveis pelas regras de acesso direto do cliente.
- Leads antigos sem Google Place ID/coordenadas não são geocodificados em massa. Na pesquisa, um resultado pode ser associado ao lead existente por nome **e endereço** exatos, quando a correspondência é única. Ao salvar uma visita, o vínculo e as coordenadas são persistidos. Não se associa uma empresa apenas por semelhança de nome.
- Visitas antigas sem identidade de conclusão aparecem como “Visitante não registrado”; não se inventa quem visitou.

## Sessão

A observação de associação descartava snapshots de cache como falha, podendo desmontar a área autenticada. Agora o snapshot de cache é ignorado enquanto se espera confirmação inicial do servidor. Após confirmação, reconexões não apagam a tela. Notificações repetidas da mesma identidade também não recriam a assinatura.

A confirmação inicial tem limite de 20 segundos. Erro real do listener, revogação, suspensão e troca de conta continuam sendo tratados. Todas as mutações revalidam a associação no servidor. Esta correção trata o comportamento identificado no código; não elimina a necessidade de autenticação inicial ou falhas reais de rede.

## Interface e idiomas

- Tipografia ampliada; entradas do fluxo móvel em 16 px e alvos de ação com pelo menos 44 px de altura.
- Navegação com altura dinâmica do viewport, lista rolável e área de conta reservada, evitando o corte inferior.
- Logo D2 ampliado e exibido inteiro com `object-fit: contain`; marca mantida no cabeçalho dos relatórios.
- Removidos o selo “Authenticated workspace” e a faixa “Commercial data is synchronized…”. Erros acionáveis continuam visíveis.
- Novos textos em inglês, português e espanhol. Ordem de idiomas EUA → Brasil → Espanha, inglês inicial e preferência persistida preservados.

## Evidências antes da publicação

- 59 testes de frontend passaram, incluindo identidade repetida, cache/reconexão, timeout inicial, revogação, associação de lugares e classificação de visitas.
- 21 testes de política do backend passaram.
- 20 testes de integração com Firestore Emulator passaram, incluindo transações, concorrência, reenvio, visitante real, carteira do vendedor e isolamento entre usuários.
- Compilação TypeScript do frontend e do backend concluída.
- Navegador em 390 × 844 e 360 × 740: Google Maps carregado; pesquisa de 20 empresas; seleção; formulário de agendamento; registro de conclusão; fechamento dos detalhes; status “Visitado” persistido após recarregar. Dados de teste somente no modo demonstrativo local.
- Desktop em 1366 × 768 e 1280 × 650: navegação, marca D2 e conta visíveis; relatório conferido visualmente.
- Português e espanhol conferidos na interface. Não foi realizado teste em aparelho físico nem em Safari iOS; as dimensões móveis foram simuladas no navegador.

## Publicação e verificação

Publicar o backend antes do frontend, pois a nova interface depende da callable de visitas. O workflow do GitHub deve passar por testes do frontend, políticas, integração, regras do Firestore, validação de configuração de produção e build antes do GitHub Pages. Conferir a página publicada, sessão autenticada, logos e carregamento do Google Maps. O resultado efetivo de publicação é registrado na entrega e no histórico do GitHub Actions.

Os registros de teste locais/emulados não são enviados ao CRM de produção.
