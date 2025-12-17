module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sand: '#cdbd9f',
        panel: '#f4deca',
        gold: '#b4882f'
      }
      ,
      spacing: {
        // custom token for logo sizing
        logo: '1.25rem',
      }
    },
  },
  plugins: [],
}
