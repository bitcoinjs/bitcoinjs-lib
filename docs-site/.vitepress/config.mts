import { defineConfig } from 'vitepress';
import { version } from '../../package.json';
import apiSidebar from '../api/typedoc-sidebar.json';

const repo = 'https://github.com/bitcoinjs/bitcoinjs-lib';

export default defineConfig({
  lang: 'en-US',
  title: 'bitcoinjs-lib',
  description: 'Bitcoin addresses, transactions, and PSBTs in JavaScript.',
  base: '/bitcoinjs-lib/',
  outDir: '../docs',
  srcExclude: ['README.md'],
  themeConfig: {
    search: { provider: 'local' },
    nav: [
      { text: 'API Reference', link: '/api/', activeMatch: '^/api/' },
      { text: `v${version}`, link: `${repo}/tree/v${version}` },
    ],
    sidebar: {
      '/api/': [{ text: 'API Reference', link: '/api/', items: apiSidebar }],
    },
    socialLinks: [{ icon: 'github', link: repo }],
    footer: { message: 'Released under the MIT License.' },
  },
});
