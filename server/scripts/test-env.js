// Imported first by test scripts: lift request limits before the app loads
process.env.RATE_LIMIT_PER_MIN ||= '100000';
process.env.AUTH_RATE_LIMIT ||= '100000';
process.env.OTP_RATE_LIMIT ||= '100000';
