export default function Inventario() {
  return (
    <div>
      <div className="page-head"><h2>Inventário</h2></div>
      <div className="card em-breve">
        <div className="em-breve-ic">🚧</div>
        <h3>Em construção — próxima etapa</h3>
        <p className="muted">
          Aqui vai ficar o <b>inventário cíclico</b>: ao ativar, o sistema separa
          <b> 30 itens por dia</b> para você conferir, <b>sem repetir na mesma semana</b>.
          Também terá <b>conferência manual</b> (escolher um item e conferir na hora)
          e o <b>histórico de cada item</b>.
        </p>
      </div>
    </div>
  )
}
