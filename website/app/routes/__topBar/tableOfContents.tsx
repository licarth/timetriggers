type Article = {
  text: string;
  link: string;
  children?: Article[];
};

export const tableOfContents: { docs: Article[]; blog: Article[] } = {
  blog: [
    {
      text: 'Firestore Billing Kill Switch',
      link: '/blog/firestore-billing-kill-switch',
    },
  ],
  docs: [
    { text: 'Introduction', link: '/docs/introduction' },
    {
      text: 'Api',
      link: '/docs/api',
      children: [
        {
          text: 'Schedule a trigger',
          link: '/docs/api/schedule',
        },
        {
          text: 'Edit a trigger',
          link: '/docs/api/edit',
        },
        {
          text: 'Cancel a trigger',
          link: '/docs/api/cancel',
        },
      ],
    },
    {
      text: 'Examples',
      link: '/docs/examples',
    },
    {
      text: 'FAQ',
      link: '/docs/faq',
    },
    {
      text: 'Product Roadmap',
      link: '/docs/product-roadmap',
    },
  ],
};
