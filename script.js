<script>
  let pedidoAtual = [];

  document.addEventListener("DOMContentLoaded", () => {
    carregarHistorico();
    carregarItensDeEstoque();
    document.getElementById("theme-toggle-btn").addEventListener("click", toggleTheme);
    setInterval(carregarHistorico, 60000); 
  });

  document.getElementById("addItemBtn").addEventListener("click", adicionarItemAoPedido);
  document.getElementById("submitBtn").addEventListener("click", handleFormSubmit);
  document.getElementById("clearBtn").addEventListener("click", limparPedido);
  document.getElementById("foraDeEstoqueCheckbox").addEventListener("change", toggleItemInput);

  // ... todas as suas funções (abrirImpressao, handleFormSubmit, etc) aqui ...
  
  function showToast(e, t = "success") {
    const o = document.getElementById("toast-container"),
      n = document.createElement("div");
    n.className = `toast toast-${t}`, n.textContent = e, o.appendChild(n), setTimeout((() => {
      n.classList.add("show")
    }), 10), setTimeout((() => {
      n.classList.remove("show"), n.addEventListener("transitionend", (() => n.remove()))
    }), 4e3)
  }
</script>
