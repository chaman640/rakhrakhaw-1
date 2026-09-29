import mongoose from 'mongoose';

export const ATTENDANCE_STATUS = ['present', 'late', 'half_day', 'absent', 'leave', 'holiday', 'weekly_off'];

const punchSchema = new mongoose.Schema(
  {
    at: { type: Date, default: null },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    photoUrl: { type: String, default: '' },
  },
  { _id: false },
);

// Ek employee ka ek din = ek record (`day` = 'YYYY-MM-DD', dukaan ke time zone me)
const attendanceSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    day: { type: String, required: true },
    status: { type: String, enum: ATTENDANCE_STATUS, default: 'present' },
    checkIn: { type: punchSchema, default: () => ({}) },
    checkOut: { type: punchSchema, default: () => ({}) },
    workMinutes: { type: Number, default: 0 },
    leavePaid: { type: Boolean, default: true },
    source: { type: String, enum: ['app', 'hr', 'leave', 'correction'], default: 'app' },
    note: { type: String, trim: true, maxlength: 300, default: '' },
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

attendanceSchema.index({ businessId: 1, userId: 1, day: 1 }, { unique: true });
attendanceSchema.index({ businessId: 1, day: 1 });

export default mongoose.model('Attendance', attendanceSchema);
