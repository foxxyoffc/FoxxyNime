import express from 'express';
import cors from 'cors';
import { connectDB, User, Content, Payment } from './db.js';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

connectDB();

const authUser = async (req, res, next) => {
  const telegramId = parseInt(req.headers['x-telegram-id']);
  if (!telegramId) return res.status(401).json({ error: 'Unauthorized' });
  let user = await User.findOne({ telegramId });
  if (!user) {
    user = await User.create({ telegramId });
  }
  req.user = user;
  next();
};

app.get('/api/contents', async (req, res) => {
  const { type, page = 1, limit = 20 } = req.query;
  const filter = type ? { type } : {};
  const contents = await Content.find(filter)
    .skip((page - 1) * limit)
    .limit(parseInt(limit));
  res.json(contents);
});

app.get('/api/content/:id', async (req, res) => {
  const content = await Content.findById(req.params.id);
  if (!content) return res.status(404).json({ error: 'Not found' });
  res.json(content);
});

app.get('/api/episode/:contentId/:episodeNumber', authUser, async (req, res) => {
  const { contentId, episodeNumber } = req.params;
  const epNum = parseInt(episodeNumber);
  const content = await Content.findById(contentId);
  if (!content) return res.status(404).json({ error: 'Content not found' });

  if (content.type === 'dracin' && epNum > 10 && !req.user.vipDracin) {
    return res.status(402).json({ 
      error: 'PAYMENT_REQUIRED',
      message: 'Episode dracin ke-11 dst hanya untuk VIP. Bayar Rp 20.000 sekali seumur hidup.',
      paymentLink: `https://t.me/${process.env.BOT_USERNAME}?start=pay_dracin_${req.user.telegramId}`
    });
  }

  if (epNum < 1 || epNum > content.totalEpisodes) {
    return res.status(400).json({ error: 'Episode invalid' });
  }
  const embedUrl = content.embedLinks[epNum - 1] || null;
  if (!embedUrl) return res.status(404).json({ error: 'Video not available' });

  if (content.type === 'dracin') {
    const history = req.user.dracinWatchHistory || new Map();
    history.set(contentId, epNum);
    req.user.dracinWatchHistory = history;
    await req.user.save();
  }

  res.json({ embedUrl, episode: epNum, title: content.title });
});

app.post('/api/payment/callback', async (req, res) => {
  const { telegramId, transactionId, status } = req.body;
  if (status === 'success') {
    const user = await User.findOne({ telegramId });
    if (user) {
      user.vipDracin = true;
      await user.save();
      await Payment.create({ userId: user._id, amount: 20000, status: 'success' });
    }
  }
  res.json({ ok: true });
});

app.get('/api/user/status', authUser, async (req, res) => {
  res.json({ vipDracin: req.user.vipDracin, telegramId: req.user.telegramId });
});

// Bot Telegram integration
import { Telegraf, Markup } from 'telegraf';

const bot = new Telegraf(process.env.BOT_TOKEN);
const webAppUrl = process.env.FRONTEND_URL || 'https://frontend-streaming-raps.vercel.app';

bot.start((ctx) => {
  ctx.reply(
    `Selamat datang ${ctx.from.first_name}!\nNonton anime, donghua gratis. Dracin episode 1-10 gratis, >10 jadi VIP seumur hidup hanya 20k.\nKlik tombol di bawah untuk membuka bioskop virtual.`,
    Markup.inlineKeyboard([
      Markup.button.webApp('🎬 BUKA MINIAPP', webAppUrl),
      Markup.button.callback('💳 Beli VIP Dracin', 'buy_vip')
    ])
  );
});

bot.action('buy_vip', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(
    'Pembayaran VIP Dracin: Rp 20.000 (seumur hidup). Silakan transfer ke Dana/OVO 081234567890 a.n Raps. Kirim bukti transfer ke @admin_bot atau klik link otomatis:',
    Markup.inlineKeyboard([
      Markup.button.url('Bayar via PayPal', 'https://paypal.me/rapsvip'),
      Markup.button.callback('Konfirmasi Manual', 'confirm_payment')
    ])
  );
});

bot.action('confirm_payment', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('Kirimkan screenshot bukti transfer beserta ID Telegram: ' + ctx.from.id);
});

app.use(await bot.createWebhook({ domain: process.env.WEBHOOK_URL }));

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server running on port ${process.env.PORT || 3000}`);
});
