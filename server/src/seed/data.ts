import { Banner } from '../models/banner.model.js';
import { Cart } from '../models/cart.model.js';
import { Category } from '../models/category.model.js';
import { Collection } from '../models/collection.model.js';
import { Counter } from '../models/counter.model.js';
import { Coupon } from '../models/coupon.model.js';
import { Newsletter } from '../models/newsletter.model.js';
import { Order } from '../models/order.model.js';
import { Page } from '../models/page.model.js';
import { Product, type ProductImage, type ProductVariant } from '../models/product.model.js';
import { Review } from '../models/review.model.js';
import { StoreSettings, getStoreSettings } from '../models/setting.model.js';
import { User } from '../models/user.model.js';
import { Wishlist } from '../models/wishlist.model.js';
import { syncCategoryProductCounts } from '../services/catalog.service.js';
import { createBannerImage, createLogoImage, createProductImage } from './placeholders.js';
import {
  bannerImage,
  catalogImageCount,
  categoryImage,
  collectionImage,
  productGallery,
} from './catalog.js';
import { env } from '../config/env.js';

export interface SeedSummary {
  users: number;
  categories: number;
  collections: number;
  products: number;
  banners: number;
  pages: number;
  coupons: number;
  reviews: number;
}

interface CategorySeed {
  name: string;
  shortDescription: string;
  icon: string;
  featured?: boolean;
}

interface ProductSeed {
  name: string;
  categorySlug: string;
  price: number;
  mrp: number;
  shortDescription: string;
  description: string;
  colors: string[];
  materials: string[];
  stones: string[];
  occasions: string[];
  tags: string[];
  variants?: { name: string; priceDelta: number; stock: number }[];
  featured?: boolean;
  newArrival?: boolean;
  bestSeller?: boolean;
  weightGrams: number;
}

const categorySeeds: CategorySeed[] = [
  { name: 'Earrings', shortDescription: 'Jhumkas, studs and chandbalis in oxidised silver', icon: 'earring', featured: true },
  { name: 'Necklaces', shortDescription: 'Chokers, layered chains and statement haars', icon: 'necklace', featured: true },
  { name: 'Bangles & Bracelets', shortDescription: 'Cuffs, kadās and stacked bangle sets', icon: 'bangle', featured: true },
  { name: 'Rings', shortDescription: 'Adjustable oxidised statement rings', icon: 'ring', featured: true },
  { name: 'Anklets', shortDescription: 'Payals with ghungroo and bead detailing', icon: 'anklet' },
  { name: 'Maang Tikka', shortDescription: 'Bridal and festive head ornaments', icon: 'tikka' },
  { name: 'Hair Accessories', shortDescription: 'Brooches, pins and boho hair jewellery', icon: 'hair' },
];

const collectionSeeds = [
  {
    name: 'Oxidised Silver Classics',
    tagline: 'Everyday heirlooms',
    description: 'The pieces that started it all — hand-finished oxidised silver with a lasting patina.',
    themeColor: '#6b6b6b',
    featured: true,
  },
  {
    name: 'Tribal & Boho',
    tagline: 'Handcrafted by artisans',
    description: 'Bell jhumkis, ghungroo payals and chunky cuffs inspired by tribal craft traditions.',
    themeColor: '#a8463f',
    featured: true,
  },
  {
    name: 'Festive Oxidised',
    tagline: 'Made for celebration',
    description: 'Kundan drops, pearl accents and antique gold tones for wedding season.',
    themeColor: '#c08a2e',
    featured: true,
  },
  {
    name: 'Everyday Minimal',
    tagline: 'Light on the ears, heavy on style',
    description: 'Featherlight studs and slim chains you can wear from desk to dinner.',
    themeColor: '#4f6f52',
    featured: false,
  },
];

const productSeeds: ProductSeed[] = [
  {
    name: 'Oxidised Silver Jhumka Earrings',
    categorySlug: 'earrings',
    price: 749,
    mrp: 1299,
    shortDescription: 'Classic dome jhumkas with a hand-etched floral rim and ghungroo fringe.',
    description:
      'Handcrafted in oxidised German silver, these jhumkas carry a deep charcoal patina that will not flake. The dome is etched with a floral lattice and finished with a soft ghungroo fringe that catches the light as you move.',
    colors: ['Silver', 'Antique Gold'],
    materials: ['Oxidised German Silver'],
    stones: ['None'],
    occasions: ['Daily', 'Festive', 'Office'],
    tags: ['jhumka', 'oxidised', 'bestseller'],
    variants: [
      { name: 'Silver Tone', priceDelta: 0, stock: 24 },
      { name: 'Antique Gold', priceDelta: 120, stock: 16 },
    ],
    featured: true,
    bestSeller: true,
    weightGrams: 34,
  },
  {
    name: 'Tribal Bell Jhumki',
    categorySlug: 'earrings',
    price: 899,
    mrp: 1499,
    shortDescription: 'Bell-shaped jhumkis with layered domes and a hand-polished oxidised finish.',
    description:
      'A three-tier bell silhouette inspired by Bastar craft. Each dome is shaped by hand, soldered and then oxidised twice for a rich, uneven patina that looks better with age.',
    colors: ['Antique Gold', 'Black'],
    materials: ['Oxidised German Silver', 'Brass'],
    stones: ['None'],
    occasions: ['Festive', 'Party', 'Wedding'],
    tags: ['jhumki', 'tribal', 'statement'],
    featured: true,
    weightGrams: 48,
  },
  {
    name: 'Peacock Motif Oxidised Studs',
    categorySlug: 'earrings',
    price: 449,
    mrp: 799,
    shortDescription: 'Lightweight peacock studs with filigree detailing.',
    description:
      'Featherlight studs with an oxidised peacock motif, perfect for long work days. Comes with a secure push-back closure and a soft anti-tarnish pouch.',
    colors: ['Silver', 'Blue'],
    materials: ['Oxidised German Silver'],
    stones: ['Kundan'],
    occasions: ['Daily', 'Office', 'Gifting'],
    tags: ['studs', 'peacock', 'minimal'],
    newArrival: true,
    weightGrams: 12,
  },
  {
    name: 'Oxidised Chandbali with Pearl Drop',
    categorySlug: 'earrings',
    price: 1099,
    mrp: 1899,
    shortDescription: 'Crescent chandbalis with a freshwater pearl drop.',
    description:
      'Crescent chandbalis in oxidised silver, balanced by a single freshwater pearl. The ear posts are nickel-free and safe for sensitive skin.',
    colors: ['Silver', 'White'],
    materials: ['Oxidised German Silver'],
    stones: ['Pearl'],
    occasions: ['Wedding', 'Festive'],
    tags: ['chandbali', 'pearl', 'wedding'],
    featured: true,
    weightGrams: 26,
  },
  {
    name: 'Oxidised Choker with Kundan Drop',
    categorySlug: 'necklaces',
    price: 1499,
    mrp: 2499,
    shortDescription: 'Adjustable oxidised choker finished with a single kundan drop.',
    description:
      'A close-fitting choker with a woven oxidised chain band and a kundan stone drop at the centre. The dori closure makes the fit fully adjustable.',
    colors: ['Silver', 'Antique Gold'],
    materials: ['Oxidised German Silver'],
    stones: ['Kundan'],
    occasions: ['Festive', 'Wedding', 'Party'],
    tags: ['choker', 'kundan', 'bestseller'],
    variants: [
      { name: 'Silver + Kundan', priceDelta: 0, stock: 14 },
      { name: 'Gold + Kundan', priceDelta: 200, stock: 9 },
    ],
    featured: true,
    bestSeller: true,
    weightGrams: 62,
  },
  {
    name: 'Layered Oxidised Chain Necklace',
    categorySlug: 'necklaces',
    price: 1699,
    mrp: 2699,
    shortDescription: 'Three-strand oxidised chain with alternating bead and coin accents.',
    description:
      'Three oxidised strands of different textures layered into one easy necklace. Coins and beads alternate along the length for a gathered, boho look.',
    colors: ['Silver', 'Black'],
    materials: ['Oxidised German Silver', 'Copper'],
    stones: ['None'],
    occasions: ['Daily', 'Party', 'Office'],
    tags: ['layered', 'chain', 'boho'],
    newArrival: true,
    weightGrams: 78,
  },
  {
    name: 'Tribal Pendant Necklace',
    categorySlug: 'necklaces',
    price: 1299,
    mrp: 1999,
    shortDescription: 'Chunky hand-cut pendant on dark oxidised links.',
    description:
      'A bold hand-cut tribal pendant on a heavy oxidised link chain. The pendant is wax-cast, so subtle marks and variations are part of the piece.',
    colors: ['Black', 'Antique Gold'],
    materials: ['Brass', 'Oxidised German Silver'],
    stones: ['None'],
    occasions: ['Festive', 'Party'],
    tags: ['tribal', 'pendant', 'chunky'],
    weightGrams: 92,
  },
  {
    name: 'Long Oxidised Haar',
    categorySlug: 'necklaces',
    price: 1899,
    mrp: 2999,
    shortDescription: 'Long haar with a temple-inspired pendant and pearl finish.',
    description:
      'A long oxidised haar inspired by temple jewellery, finished with a row of faux pearls and a detachable pendant. Can be doubled into a choker.',
    colors: ['Silver', 'White'],
    materials: ['Oxidised German Silver'],
    stones: ['Pearl', 'Kundan'],
    occasions: ['Wedding', 'Festive'],
    tags: ['haar', 'long', 'bridal'],
    featured: true,
    weightGrams: 118,
  },
  {
    name: 'Oxidised Cuff Bracelet',
    categorySlug: 'bangles-and-bracelets',
    price: 649,
    mrp: 1099,
    shortDescription: 'Open-cuff bracelet with a hammered oxidised surface.',
    description:
      'A wide open cuff with a hammered oxidised surface. Because it is open, one size fits most wrists and it layers beautifully with bangles.',
    colors: ['Silver', 'Antique Gold'],
    materials: ['Oxidised German Silver'],
    stones: ['None'],
    occasions: ['Daily', 'Office'],
    tags: ['cuff', 'bracelet', 'stackable'],
    bestSeller: true,
    weightGrams: 42,
  },
  {
    name: 'Set of 4 Oxidised Bangles',
    categorySlug: 'bangles-and-bracelets',
    price: 1199,
    mrp: 1899,
    shortDescription: 'Four slim bangles with alternating etched and plain bands.',
    description:
      'A stack of four slim bangles — two etched with a chevron pattern, two left plain. Sold as a set and sized to wear together without rattling.',
    colors: ['Silver', 'Black'],
    materials: ['Oxidised German Silver'],
    stones: ['None'],
    occasions: ['Festive', 'Daily'],
    tags: ['bangles', 'set', 'stackable'],
    variants: [
      { name: 'Size 2.4', priceDelta: 0, stock: 18 },
      { name: 'Size 2.6', priceDelta: 0, stock: 21 },
      { name: 'Size 2.8', priceDelta: 60, stock: 11 },
    ],
    newArrival: true,
    weightGrams: 88,
  },
  {
    name: 'Filigree Oxidised Kada',
    categorySlug: 'bangles-and-bracelets',
    price: 1399,
    mrp: 2199,
    shortDescription: 'Broad kada with pierced filigree work and a hidden clasp.',
    description:
      'A broad kada featuring pierced filigree work across the front and a hidden push clasp at the back so it sits flat on the wrist.',
    colors: ['Antique Gold', 'Silver'],
    materials: ['Oxidised German Silver', 'Brass'],
    stones: ['None'],
    occasions: ['Wedding', 'Festive'],
    tags: ['kada', 'filigree', 'bridal'],
    weightGrams: 96,
  },
  {
    name: 'Oxidised Adjustable Ring',
    categorySlug: 'rings',
    price: 299,
    mrp: 549,
    shortDescription: 'Adjustable band with a textured oxidised dome.',
    description:
      'An adjustable oxidised ring that fits any finger. The band is deliberately left raw so the patina develops its own character.',
    colors: ['Silver', 'Black'],
    materials: ['Oxidised German Silver'],
    stones: ['None'],
    occasions: ['Daily', 'Office', 'Gifting'],
    tags: ['ring', 'adjustable', 'gifting'],
    bestSeller: true,
    weightGrams: 9,
  },
  {
    name: 'Silver Oxidised Statement Ring',
    categorySlug: 'rings',
    price: 549,
    mrp: 899,
    shortDescription: 'Oversized statement ring with a kundan centre stone.',
    description:
      'A statement ring for festive dressing, set with a single kundan stone in a raised oxidised bezel.',
    colors: ['Silver', 'Antique Gold'],
    materials: ['Oxidised German Silver'],
    stones: ['Kundan'],
    occasions: ['Party', 'Festive', 'Wedding'],
    tags: ['ring', 'statement', 'kundan'],
    newArrival: true,
    weightGrams: 18,
  },
  {
    name: 'Oxidised Payal with Ghungroo',
    categorySlug: 'anklets',
    price: 799,
    mrp: 1299,
    shortDescription: 'Pair of payals strung with ghungroo bells and beads.',
    description:
      'A pair of oxidised payals hand-strung with ghungroo bells and small beads. The chain is reinforced where it takes the most stress, so it holds up to daily wear.',
    colors: ['Silver', 'Black'],
    materials: ['Oxidised German Silver'],
    stones: ['None'],
    occasions: ['Festive', 'Daily', 'Wedding'],
    tags: ['payal', 'anklet', 'ghungroo'],
    variants: [
      { name: 'Antique Finish', priceDelta: 0, stock: 22 },
      { name: 'Black Finish', priceDelta: 80, stock: 15 },
    ],
    featured: true,
    bestSeller: true,
    weightGrams: 64,
  },
  {
    name: 'Beaded Oxidised Anklet',
    categorySlug: 'anklets',
    price: 499,
    mrp: 799,
    shortDescription: 'Single anklet with turquoise-look beads.',
    description:
      'A lightweight single anklet with turquoise-look beads and a lobster clasp. Sold individually so you can mix and match.',
    colors: ['Silver', 'Blue'],
    materials: ['Oxidised German Silver'],
    stones: ['Turquoise'],
    occasions: ['Daily', 'Party'],
    tags: ['anklet', 'beaded', 'boho'],
    newArrival: true,
    weightGrams: 28,
  },
  {
    name: 'Oxidised Maang Tikka with Pearl',
    categorySlug: 'maang-tikka',
    price: 899,
    mrp: 1499,
    shortDescription: 'Maang tikka with a pearl cluster centre and chain fringe.',
    description:
      'A bridal maang tikka built on an oxidised frame, with a pearl cluster at the centre and a fine chain fringe that frames the forehead.',
    colors: ['Silver', 'White'],
    materials: ['Oxidised German Silver'],
    stones: ['Pearl'],
    occasions: ['Wedding', 'Festive'],
    tags: ['maang tikka', 'bridal', 'pearl'],
    featured: true,
    weightGrams: 32,
  },
  {
    name: 'Oxidised Hair Brooch',
    categorySlug: 'hair-accessories',
    price: 399,
    mrp: 699,
    shortDescription: 'Flower-motif brooch for buns and braids.',
    description:
      'A flower-motif oxidised brooch with a strong pin bar, made for buns, braids and dupatta styling.',
    colors: ['Silver', 'Antique Gold'],
    materials: ['Oxidised German Silver'],
    stones: ['None'],
    occasions: ['Festive', 'Wedding', 'Daily'],
    tags: ['hair', 'brooch', 'flower'],
    weightGrams: 16,
  },
  {
    name: 'Boho Oxidised Hair Pin Set',
    categorySlug: 'hair-accessories',
    price: 549,
    mrp: 899,
    shortDescription: 'Set of 6 mixed oxidised hair pins.',
    description:
      'Six mixed oxidised hair pins with beads, coins and leaf motifs so you can build your own arrangement.',
    colors: ['Silver', 'Black', 'Blue'],
    materials: ['Oxidised German Silver', 'Copper'],
    stones: ['None'],
    occasions: ['Daily', 'Party'],
    tags: ['hair', 'pins', 'set'],
    bestSeller: true,
    weightGrams: 22,
  },
];

const pageSeeds = [
  {
    title: 'About Us',
    excerpt: 'Handcrafted oxidised jewellery, made in small batches by artisan clusters.',
    content:
      '<h2>Our story</h2><p>We work directly with artisan clusters across Rajasthan and Odisha to bring hand-finished oxidised jewellery to modern wardrobes. Every piece is shaped, soldered and oxidised by hand, which means no two are exactly alike.</p><h3>Why oxidised?</h3><p>Oxidised silver has a deep charcoal patina that never flakes and only improves with wear. It is also lighter on the wallet than polished silver while looking just as considered.</p>',
  },
  {
    title: 'Shipping & Returns',
    excerpt: 'Free shipping over ₹999 and easy 7-day returns.',
    content:
      '<h2>Shipping</h2><p>Orders are dispatched within 2 working days. Standard delivery takes 4-7 working days across India. Shipping is free on orders above ₹999, otherwise a flat ₹79 applies.</p><h2>Returns</h2><p>Not the right fit? Return unused pieces in original packaging within 7 days of delivery for a full refund to your original payment method. Made-to-order and pierced earring sets are non-returnable for hygiene reasons.</p>',
  },
  {
    title: 'Jewellery Care',
    excerpt: 'Keep your oxidised pieces looking new.',
    content:
      '<h2>Care guide</h2><ul><li>Keep oxidised jewellery away from water, perfume and hair spray.</li><li>Wipe with the soft pouch included after each wear.</li><li>Store pieces separately so chains do not tangle.</li><li>Do not use silver polish — it removes the oxidised finish.</li></ul>',
  },
  {
    title: 'Privacy Policy',
    excerpt: 'How we collect, use and protect your personal data.',
    content:
      '<h2>Data we collect</h2><p>We collect only what is needed to process your order: name, contact details, delivery address and order history. Payment card details are never stored on our servers.</p><h2>Your rights</h2><p>Write to us any time to access, correct or delete your personal data.</p>',
  },
  {
    title: 'Terms of Service',
    excerpt: 'The terms that apply when you shop with us.',
    content:
      '<h2>Using this store</h2><p>By placing an order you confirm that the information you provide is accurate and that you are authorised to use the chosen payment method.</p><h2>Pricing</h2><p>All prices are in INR and inclusive of applicable taxes where stated. We may update prices without notice, but never after an order is confirmed.</p>',
  },
];

async function upsertUser(input: {
  name: string;
  email: string;
  password: string;
  role: 'customer' | 'manager' | 'admin';
}) {
  const existing = await User.findOne({ email: input.email });

  if (existing) {
    return existing;
  }

  return User.create({
    name: input.name,
    email: input.email,
    passwordHash: await User.hashPassword(input.password),
    role: input.role,
    emailVerified: true,
    isActive: true,
  });
}

export async function clearDatabase(): Promise<void> {
  await Promise.all([
    User.deleteMany({}),
    Category.deleteMany({}),
    Collection.deleteMany({}),
    Product.deleteMany({}),
    Cart.deleteMany({}),
    Wishlist.deleteMany({}),
    Order.deleteMany({}),
    Coupon.deleteMany({}),
    Review.deleteMany({}),
    Banner.deleteMany({}),
    Page.deleteMany({}),
    Newsletter.deleteMany({}),
    Counter.deleteMany({}),
  ]);
}

export async function seedDatabase(): Promise<SeedSummary> {
  const admin = await upsertUser({
    name: env.SEED_ADMIN_NAME,
    email: env.SEED_ADMIN_EMAIL,
    password: env.SEED_ADMIN_PASSWORD,
    role: 'admin',
  });

  await upsertUser({
    name: 'Store Manager',
    email: 'manager@oxidisedjewellery.test',
    password: 'Manager@12345',
    role: 'manager',
  });

  const customer = await upsertUser({
    name: 'Riya Sharma',
    email: env.SEED_CUSTOMER_EMAIL,
    password: env.SEED_CUSTOMER_PASSWORD,
    role: 'customer',
  });

  const logoUrl = await createLogoImage();

  await getStoreSettings();
  await StoreSettings.updateOne(
    {},
    {
      $set: {
        storeName: 'Oxidised Jewellery',
        tagline: 'Handcrafted oxidised silver, made in small batches',
        logo: { url: logoUrl },
        supportEmail: 'care@oxidisedjewellery.test',
        supportPhone: '+91 825003***7',
        whatsappNumber: '++91 825003***7',
        addressLines: ['Lal Darwaja', 'Ahmedabad 302003'],
        gstNumber: '08ABCDE1234F1Z5',
        taxPercent: 3,
        taxLabel: 'GST',
        shippingFlatRate: 79,
        freeShippingThreshold: 999,
        codEnabled: true,
        codFee: 30,
        minOrderValue: 199,
        announcement: {
          text: 'Free shipping on orders above ₹999 · Easy 7-day returns',
          link: '/shop',
          isActive: true,
        },
        social: {
          instagram: 'https://instagram.com',
          facebook: 'https://facebook.com',
          pinterest: 'https://pinterest.com',
        },
        updatedBy: admin._id,
      },
    },
    { upsert: true },
  );

  const categoryIdBySlug = new Map<string, string>();

  for (const [index, category] of categorySeeds.entries()) {
    const slug = category.name
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const image = categoryImage(slug, index) ?? (await createProductImage(`category-${slug}`, category.name, index + 2));

    const document = await Category.findOneAndUpdate(
      { slug },
      {
        $set: {
          name: category.name,
          slug,
          shortDescription: category.shortDescription,
          icon: category.icon,
          image: { url: image, alt: category.name },
          sortOrder: index,
          isActive: true,
          isFeatured: category.featured ?? false,
        },
      },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
    );

    categoryIdBySlug.set(slug, String(document._id));
  }

  const collectionIdByName = new Map<string, string>();

  for (const [index, collection] of collectionSeeds.entries()) {
    const slug = collection.name
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const heroImage = collectionImage(index) ?? (await createBannerImage(`collection-${slug}`, index));

    const document = await Collection.findOneAndUpdate(
      { slug },
      {
        $set: {
          name: collection.name,
          slug,
          tagline: collection.tagline,
          description: collection.description,
          heroImage: { url: heroImage, alt: collection.name },
          thumbnail: { url: heroImage, alt: collection.name },
          themeColor: collection.themeColor,
          sortOrder: index,
          isActive: true,
          isFeatured: collection.featured,
        },
      },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
    );

    collectionIdByName.set(collection.name, String(document._id));
  }

  const collectionForProduct = (index: number): string[] => {
    const names = [
      'Oxidised Silver Classics',
      'Tribal & Boho',
      'Festive Oxidised',
      'Everyday Minimal',
    ];

    const primary = names[index % names.length];
    const secondary = names[(index + 2) % names.length];

    return [primary, secondary]
      .map((name) => collectionIdByName.get(name as string))
      .filter((id): id is string => Boolean(id));
  };

  let productIndex = 0;

  for (const seed of productSeeds) {
    const categoryId = categoryIdBySlug.get(seed.categorySlug);

    if (!categoryId) {
      throw new Error(
        `Seed data error: product "${seed.name}" references unknown category slug "${seed.categorySlug}"`,
      );
    }

    const slug = seed.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Several slugs share a prefix ("oxidised-ch..."), so a truncated slug alone
    // is not unique. The zero-padded index keeps every SKU distinct.
    const sku = `OX-${slug.toUpperCase().slice(0, 24)}-${String(productIndex + 1).padStart(3, '0')}`;

    const gallery = productGallery(seed.categorySlug, productIndex, seed.name);
    const images: ProductImage[] = [];

    if (gallery) {
      images.push(...gallery);
    } else {
      for (let index = 0; index < 3; index += 1) {
        images.push({
          url: await createProductImage(slug, seed.name, index),
          alt: `${seed.name} — view ${index + 1}`,
          isPrimary: index === 0,
          sortOrder: index,
        });
      }
    }

    const variants: ProductVariant[] = (seed.variants ?? []).map((variant, index) => ({
      name: variant.name,
      sku: `${sku}-${index + 1}`,
      price: seed.price + variant.priceDelta,
      mrp: seed.mrp + variant.priceDelta,
      stock: variant.stock,
      isActive: true,
    }));

    const totalStock = variants.length
      ? variants.reduce((total, variant) => total + variant.stock, 0)
      : 20 + ((productIndex * 7) % 30);

    await Product.findOneAndUpdate(
      { slug },
      {
        $set: {
          name: seed.name,
          slug,
          sku,
          shortDescription: seed.shortDescription,
          description: seed.description,
          category: categoryId,
          collections: collectionForProduct(productIndex),
          tags: seed.tags,
          price: seed.price,
          mrp: seed.mrp,
          costPrice: Math.round(seed.price * 0.55),
          stock: totalStock,
          lowStockThreshold: 5,
          images,
          variants,
          colors: seed.colors,
          materials: seed.materials,
          stones: seed.stones,
          occasions: seed.occasions,
          specifications: [
            { label: 'Material', value: seed.materials.join(', ') },
            { label: 'Finish', value: 'Hand-oxidised' },
            { label: 'Weight', value: `${seed.weightGrams} g` },
            { label: 'Closure', value: variants.length ? 'Variant dependant' : 'Push back' },
            { label: 'Care', value: 'Wipe with a dry soft cloth. Keep away from water and perfume.' },
          ],
          weightGrams: seed.weightGrams,
          dimensions: { lengthCm: 6, widthCm: 4, heightCm: 2 },
          careInstructions:
            'Store in the pouch provided. Avoid water, perfume and polishing agents to preserve the oxidised finish.',
          badges: seed.bestSeller ? ['Bestseller'] : seed.newArrival ? ['New'] : [],
          isFeatured: seed.featured ?? false,
          isNewArrival: seed.newArrival ?? false,
          isBestSeller: seed.bestSeller ?? false,
          isActive: true,
          publishedAt: new Date(),
          metaTitle: `${seed.name} | Oxidised Jewellery`,
          metaDescription: seed.shortDescription,
          keywords: seed.tags,
        },
      },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
    );

    productIndex += 1;
  }

  const bannerSeeds = [
    {
      slug: 'hero-festive',
      title: 'The Festive Oxidised Edit',
      subtitle: 'Kundan drops and antique gold tones',
      cta: 'Shop the edit',
      url: '/collections/festive-oxidised',
      position: 'hero' as const,
    },
    {
      slug: 'hero-tribal',
      title: 'Tribal & Boho',
      subtitle: 'Handcrafted by artisan clusters',
      cta: 'Explore tribal',
      url: '/collections/tribal-and-boho',
      position: 'hero' as const,
    },
    {
      slug: 'strip-everyday',
      title: 'Everyday Minimal',
      subtitle: 'Featherlight pieces under ₹699',
      cta: 'Shop under ₹699',
      url: '/shop?sort=price',
      position: 'promo_strip' as const,
    },
  ];

  for (const [index, banner] of bannerSeeds.entries()) {
    const image = bannerImage(index) ?? (await createBannerImage(banner.slug, index));

    await Banner.findOneAndUpdate(
      { title: banner.title },
      {
        $set: {
          title: banner.title,
          subtitle: banner.subtitle,
          image: { url: image, alt: banner.title },
          ctaLabel: banner.cta,
          ctaUrl: banner.url,
          position: banner.position,
          sortOrder: index,
          isActive: true,
          createdBy: admin._id,
        },
      },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
    );
  }

  for (const [index, page] of pageSeeds.entries()) {
    const slug = page.title
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    await Page.findOneAndUpdate(
      { slug },
      {
        $set: {
          title: page.title,
          slug,
          excerpt: page.excerpt,
          content: page.content,
          isPublished: true,
          showInFooter: true,
          showInHeader: page.title === 'About Us',
          sortOrder: index,
        },
      },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
    );
  }

  const couponSeeds = [
    {
      code: 'WELCOME10',
      description: '10% off your first order',
      type: 'percentage' as const,
      value: 10,
      maxDiscount: 300,
      minOrderValue: 799,
      firstOrderOnly: true,
      perUserLimit: 1,
    },
    {
      code: 'OXIDISED200',
      description: 'Flat ₹200 off orders above ₹1499',
      type: 'fixed' as const,
      value: 200,
      minOrderValue: 1499,
      perUserLimit: 2,
    },
    {
      code: 'FREESHIP',
      description: 'Free shipping on any order',
      type: 'free_shipping' as const,
      value: 0,
      minOrderValue: 0,
      perUserLimit: 5,
    },
  ];

  for (const coupon of couponSeeds) {
    await Coupon.findOneAndUpdate(
      { code: coupon.code },
      {
        $set: {
          ...coupon,
          expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
          isActive: true,
        },
      },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
    );
  }

  const reviewSeeds = [
    {
      productSlug: 'oxidised-silver-jhumka-earrings',
      rating: 5,
      title: 'Exactly like the photos',
      body: 'The patina is gorgeous and they are surprisingly light. Wore them for six hours with no ear pain.',
      status: 'approved' as const,
    },
    {
      productSlug: 'oxidised-silver-jhumka-earrings',
      rating: 4,
      title: 'Beautiful, slightly heavy',
      body: 'Lovely detailing. Slightly heavier than my other jhumkas but worth it for festive wear.',
      status: 'approved' as const,
    },
    {
      productSlug: 'oxidised-choker-with-kundan-drop',
      rating: 5,
      title: 'Perfect for my sister\u2019s wedding',
      body: 'The kundan drop catches the light beautifully and the dori makes the fit adjustable.',
      status: 'approved' as const,
    },
    {
      productSlug: 'oxidised-adjustable-ring',
      rating: 4,
      title: 'Great everyday ring',
      body: 'Adjustable as promised. The finish has not faded even after daily wear.',
      status: 'approved' as const,
    },
    {
      productSlug: 'tribal-pendant-necklace',
      rating: 5,
      title: 'Statement piece',
      body: 'Chunky and bold, exactly what I wanted for a party.',
      status: 'pending' as const,
    },
  ];

  let reviewCount = 0;

  for (const review of reviewSeeds) {
    const product = await Product.findOne({ slug: review.productSlug }).select('_id');

    if (!product) {
      continue;
    }

    await Review.findOneAndUpdate(
      { product: product._id, user: customer._id },
      {
        $set: {
          product: product._id,
          user: customer._id,
          authorName: customer.name,
          rating: review.rating,
          title: review.title,
          body: review.body,
          status: review.status,
          isVerifiedPurchase: true,
        },
      },
      { upsert: true, setDefaultsOnInsert: true },
    );

    reviewCount += 1;
  }

  const products = await Product.find({ isActive: true }).select('_id');
  const perProductRating = new Map<string, { total: number; count: number }>();

  const approvedReviews = await Review.find({ status: 'approved' });

  for (const review of approvedReviews) {
    const key = String(review.product);
    const current = perProductRating.get(key) ?? { total: 0, count: 0 };
    current.total += review.rating;
    current.count += 1;
    perProductRating.set(key, current);
  }

  for (const product of products) {
    const stats = perProductRating.get(String(product._id));

    await Product.updateOne(
      { _id: product._id },
      {
        ratingsAverage: stats ? Number((stats.total / stats.count).toFixed(1)) : 0,
        ratingsCount: stats?.count ?? 0,
        soldCount: stats ? stats.count * 3 : 0,
      },
    );
  }

  await syncCategoryProductCounts();

  const [users, categories, collections, productTotal, banners, pages, coupons, reviews] =
    await Promise.all([
      User.countDocuments({}),
      Category.countDocuments({}),
      Collection.countDocuments({}),
      Product.countDocuments({}),
      Banner.countDocuments({}),
      Page.countDocuments({}),
      Coupon.countDocuments({}),
      Review.countDocuments({}),
    ]);

  return {
    users,
    categories,
    collections,
    products: productTotal,
    banners,
    pages,
    coupons,
    reviews,
  };
}
