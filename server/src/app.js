import express from 'express';
import path from 'path';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import { env } from './config/env.js';
import apiRoutes from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(cors({ origin: env.clientUrl, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
if (!env.isProd) app.use(morgan('dev'));

// Local upload ki images (Cloudinary set nahi hai to yahi use hoti hain)
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

app.get('/', (req, res) => {
  res.json({ success: true, message: 'Rakh Rakhav API', version: '1.0.0' });
});

app.use('/api', apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
