
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        trello: { header:'#0079BF', blue:'#026AA7', list:'#EBECF0', card:'#FFFFFF', page:'#E4F0F6', text:'#172B4D', muted:'#44546F' },
        tdark:  { page:'#0F172A', header:'#0B5CAD', list:'#1F2937', card:'#111827', text:'#E6EDFA', muted:'#AAB7CF' }
      },
      boxShadow: { card:'0 1px 0 rgba(9,30,66,.25),0 0 0 1px rgba(9,30,66,.08)' },
      borderRadius: { xl2:'1rem' }
    }
  },
  plugins: []
}
