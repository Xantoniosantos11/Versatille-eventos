/* =========================================================
   VERSATILLE | CAMADA DE IMPRESSAO
   - Documentos padronizados para ESC/POS
   - Preparada para ponte Android/Bluetooth
   - Fallback seguro para impressao do navegador
   ========================================================= */
(function(){
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
  function money(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
  function buildOrderDocument(sale){
    const items=(sale.sale_items||[]).map(i=>`<div class="line"><span>${Number(i.quantity||0)}× ${esc(i.products?.name||'Produto')}</span></div>`).join('');
    return `<div class="ticket"><div class="center bold">VERSATILLE EVENTOS</div><div class="center bold">FICHA DE RETIRADA</div><hr><div><b>PEDIDO Nº ${esc(sale.order_number||sale.id)}</b></div><div>GARÇOM: ${esc(sale.seller_name||'Garçom')}</div><div>${esc(new Date(sale.created_at).toLocaleString('pt-BR'))}</div><hr>${items||'<div>Sem itens</div>'}<hr><div class="center bold">RETIRADA NO BAR</div></div>`;
  }
  function printHtml(title, body){
    const w=window.open('','_blank','width=420,height=720');
    if(!w){ alert('O navegador bloqueou a janela de impressão. Permita pop-ups para o Versatille.'); return false; }
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:Arial,sans-serif;margin:0;padding:10px;background:#fff;color:#000}.ticket{width:100%;max-width:360px;margin:auto;font-size:14px;line-height:1.45}.center{text-align:center}.bold{font-weight:700}.line{padding:2px 0}hr{border:0;border-top:1px dashed #000;margin:9px 0}@media print{body{padding:0}.ticket{max-width:none}}</style></head><body>${body}</body></html>`);
    w.document.close(); w.focus(); setTimeout(()=>{w.print();},180); return true;
  }
  window.VersatillePrinter={
    async register(saleId,type,status,reason,metadata={}){
      if(!window.supabaseClient) return {error:{message:'Supabase indisponível.'}};
      return await window.supabaseClient.rpc('register_print_event',{p_sale_id:saleId,p_print_type:type,p_status:status,p_reason:reason||null,p_metadata:metadata});
    },
    async printOrder(sale, type='ORIGINAL', reason=null){
      const ok=printHtml(`Pedido ${sale.order_number||sale.id}`,buildOrderDocument(sale));
      await this.register(sale.id,type,ok?'SUCESSO':'FALHA',reason,{transport:'BROWSER_PRINT'});
      return ok;
    }
  };
})();
