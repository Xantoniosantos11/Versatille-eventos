# Versatille Eventos - Impressão e Auditoria

Esta atualização é **aditiva**. Ela não substitui `create_sale()` nem `create_sale_split()`.

## O que foi preparado
- Número sequencial de pedido gerado pelo banco, independente do celular.
- Auditoria de impressão original e reimpressão.
- Garçom: somente impressão original do próprio pedido.
- Organização: resumo diário para impressão.
- ADM: relatórios e reimpressão de pedidos.
- Reimpressões registradas com pedido, garçom, ADM, data/hora, número da cópia e motivo.
- Base de impressão preparada para a futura camada Android/Bluetooth/ESC-POS.

## Ordem segura de implantação
1. Publicar este pacote no GitHub/Cloudflare.
2. Depois executar **uma única vez** `SQL_IMPRESSAO_AUDITORIA.sql` no Supabase.
3. Fazer testes com uma venda de teste.
4. A camada Bluetooth nativa será conectada em etapa própria. O fallback atual usa a impressão do navegador para validar documentos e permissões sem depender de Wi-Fi.

## Não fazer
- Não remover funções existentes.
- Não substituir `create_sale()`.
- Não apagar dados.
