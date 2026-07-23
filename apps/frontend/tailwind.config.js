module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  safelist: [
    {
      pattern: /^(bg|text|border)-(blue|amber|purple|emerald|rose|cyan|orange|indigo|slate)-(400|500|600|700)/,
      variants: ['hover'],
    },
    {
      pattern: /^(bg|border)-(blue|amber|purple|emerald|rose|cyan|orange|indigo)-(500)\/(10|15|20|25|30)/,
    },
    {
      pattern: /^text-(blue|amber|purple|emerald|rose|cyan|orange|indigo)-(300|400)/,
    },
    {
      pattern: /^shadow-(blue|amber|purple|emerald|rose|cyan|turkcell-yellow)-(500|600)\/(10|20|30)/,
    },
  ],
  theme: {
    extend: {
      colors: {
        turkcell: {
          navy: '#002561',
          blue: '#0057B8',
          lightBlue: '#1D70B8',
          yellow: '#FFC72C',
          gold: '#F2A900',
          darkBg: '#050810',
          cardBg: '#0C1222',
          cardBorder: '#1A2235',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
