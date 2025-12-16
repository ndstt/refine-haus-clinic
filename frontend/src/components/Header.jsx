export default function Header() {
  return (
    <header className="header">
      <div className="brand">
        <div className="logoCircle" img="./assets/rfc-logo.jpg"></div>
        <div className="brandText">
          <div className="brandTop">REFINE HAUS</div>
          <div className="brandBottom">CLINIC</div>
        </div>
      </div>

      <nav className="nav">
        <a href="#">HOME</a>
        <a href="#">BLOG</a>
        <a className="active" href="#">SERVICES</a>
      </nav>
    </header>
  );
}
