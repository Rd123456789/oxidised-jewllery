import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextFunction, Request, Response } from 'express';
import { PortfolioInquiry } from '../models/portfolioInquiry.model.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler, sendSuccess } from '../utils/http.js';
import { logger } from '../utils/logger.js';
import { signAccessToken, verifyAccessToken } from '../utils/tokens.js';

const here = path.dirname(fileURLToPath(import.meta.url));

const ADMIN_EMAIL = 'rajdipparmar221@gmail.com';
const ADMIN_PASSWORD = 'Rajdip053';

function resolveCvPath(): string | null {
  const candidates = [
    path.resolve(here, '..', '..', 'assets', 'Rajdip-parmar-cv.pdf'),
    path.resolve(process.cwd(), 'assets', 'Rajdip-parmar-cv.pdf'),
    path.resolve(process.cwd(), 'server', 'assets', 'Rajdip-parmar-cv.pdf'),
    path.resolve(here, '..', 'assets', 'Rajdip-parmar-cv.pdf'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export const submitContactInquiry = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, message, source } = req.body as {
    name: string;
    email: string;
    message: string;
    source?: string;
  };

  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
  const userAgent = req.headers['user-agent'] || '';

  const inquiry = await PortfolioInquiry.create({
    name,
    email,
    message,
    source: source || 'portfolio-3d',
    ip: String(clientIp).split(',')[0]?.trim() || '',
    userAgent: String(userAgent).slice(0, 255),
    isRead: false,
  });

  logger.info(`Portfolio inquiry received from ${name} <${email}>`);

  sendSuccess(
    res,
    {
      id: inquiry.id,
      name: inquiry.name,
      email: inquiry.email,
      receivedAt: inquiry.createdAt,
    },
    {
      status: 201,
      message: 'Inquiry received successfully. Rajdip will get back to you shortly!',
    },
  );
});

export const getPortfolioCv = asyncHandler(async (req: Request, res: Response) => {
  const cvPath = resolveCvPath();

  if (req.query.format === 'json' || (req.accepts('json') && !req.accepts('pdf') && !req.query.download)) {
    sendSuccess(res, {
      filename: 'Rajdip-parmar-cv.pdf',
      downloadUrl: '/api/v1/portfolio/cv?download=true',
      viewUrl: '/api/v1/portfolio/cv',
      cloudinaryImageUrl: 'https://res.cloudinary.com/m0eipl05/image/upload/v1791033028/portfolio/Rajdip-parmar-cv.jpg',
      available: Boolean(cvPath),
    });
    return;
  }

  if (!cvPath) {
    throw ApiError.notFound('CV document not found on server');
  }

  const stat = fs.statSync(cvPath);
  const disposition = req.query.download === 'true' ? 'attachment' : 'inline';

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Content-Disposition', `${disposition}; filename="Rajdip-parmar-cv.pdf"`);
  res.setHeader('Cache-Control', 'public, max-age=86400');

  const stream = fs.createReadStream(cvPath);
  stream.pipe(res);
});

export const portfolioAdminLogin = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (
    !email ||
    !password ||
    email.trim().toLowerCase() !== ADMIN_EMAIL.toLowerCase() ||
    password !== ADMIN_PASSWORD
  ) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const token = signAccessToken({
    sub: 'portfolio-admin-rajdip',
    email: ADMIN_EMAIL,
    role: 'admin',
    accountType: 'admin',
  });

  sendSuccess(
    res,
    {
      token,
      user: {
        email: ADMIN_EMAIL,
        name: 'Rajdip Parmar',
        role: 'admin',
      },
    },
    { message: 'Admin authentication successful' },
  );
});

export function requirePortfolioAdmin(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    throw ApiError.unauthorized('Admin authentication required');
  }

  const token = authHeader.slice(7).trim();
  const payload = verifyAccessToken(token);

  if (payload.email !== ADMIN_EMAIL || payload.role !== 'admin') {
    throw ApiError.forbidden('Forbidden: Portfolio admin access required');
  }

  next();
}

export const listPortfolioInquiries = asyncHandler(async (_req: Request, res: Response) => {
  const inquiries = await PortfolioInquiry.find().sort({ createdAt: -1 }).lean();
  sendSuccess(res, inquiries);
});

export const markPortfolioInquiryRead = asyncHandler(async (req: Request, res: Response) => {
  const inquiry = await PortfolioInquiry.findByIdAndUpdate(
    req.params.id,
    { isRead: true },
    { returnDocument: 'after' },
  ).lean();

  if (!inquiry) {
    throw ApiError.notFound('Inquiry not found');
  }

  sendSuccess(res, inquiry, { message: 'Inquiry marked as read' });
});

export const deletePortfolioInquiry = asyncHandler(async (req: Request, res: Response) => {
  const inquiry = await PortfolioInquiry.findByIdAndDelete(req.params.id).lean();

  if (!inquiry) {
    throw ApiError.notFound('Inquiry not found');
  }

  sendSuccess(res, { id: req.params.id }, { message: 'Inquiry deleted successfully' });
});
