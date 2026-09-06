VERSATILLE EVENTOS - FINAL PAGAMENTO DIVIDIDO + CONTROLE DE PERIODOS

Esta versão reúne:
- pagamento dividido em uma única venda via create_sale_split();
- controle manual de períodos operacionais;
- liberação individual de garçons por período;
- fechamento individual do garçom no período;
- consulta de fechamento individual por período;
- relatórios diários e relatório do evento;
- organização somente leitura;
- PWA/instalação.

BANCO:
- A função create_sale() existente NÃO é substituída.
- A nova função usada pelo app é create_sale_split(uuid,jsonb,jsonb).
- Não executar novamente a SQL se create_sale_split já estiver criada, salvo se houver necessidade de atualização futura.

APP:
- Em ADM > Eventos > Períodos, o ADM cria cada período manualmente.
- Depois deve liberar cada garçom individualmente.
- Fechar um garçom bloqueia novas vendas dele somente naquele período.
- O próximo período exige nova liberação manual.
