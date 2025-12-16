export default function ServiceCard({ service }) {
  const { category, title, price, image } = service;

  return (
    <article className="card">
      <div className="cardImageWrap">
        <img className="cardImage" src={image} alt={title} loading="lazy" />
      </div>

      <div className="cardBody">
        <div className="cardCategory">{category}</div>
        <div className="cardTitle">{title}</div>
        <div className="cardPrice">THB. {price.toLocaleString("th-TH")}</div>
      </div>
    </article>
  );
}
