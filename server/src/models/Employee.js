import mongoose from 'mongoose';

/**
 * HR profile — login wala User hi employee hai; ye sirf HR ki jaankari jodta hai
 * (ek employee = ek User = ek profile, koi doosri copy nahi).
 */
const employeeSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    code: { type: String, required: true },

    photoUrl: { type: String, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    dob: { type: Date, default: null },
    gender: { type: String, enum: ['', 'male', 'female', 'other'], default: '' },
    address: { type: String, trim: true, maxlength: 300, default: '' },
    emergencyContact: {
      name: { type: String, trim: true, default: '' },
      phone: { type: String, trim: true, default: '' },
    },

    joiningDate: { type: Date, default: Date.now },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'OrgUnit', default: null },
    designationId: { type: mongoose.Schema.Types.ObjectId, ref: 'OrgUnit', default: null },
    reportingManagerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    employmentType: { type: String, enum: ['full_time', 'part_time', 'contract', 'intern'], default: 'full_time' },
    status: { type: String, enum: ['active', 'inactive', 'left'], default: 'active' },
    leftAt: { type: Date, default: null },

    salary: {
      type: { type: String, enum: ['monthly', 'daily'], default: 'monthly' },
      basic: { type: Number, min: 0, default: 0 },
      allowances: { type: Number, min: 0, default: 0 },
      commissionPct: { type: Number, min: 0, max: 100, default: 0 },
      monthlyTarget: { type: Number, min: 0, default: 0 },
      effectiveFrom: { type: Date, default: null },
    },

    documents: {
      type: [{
        type: { type: String, trim: true, maxlength: 40 },
        number: { type: String, trim: true, maxlength: 60, default: '' },
        expiry: { type: Date, default: null },
      }],
      default: [],
    },
  },
  { timestamps: true },
);

employeeSchema.index({ businessId: 1, status: 1 });

export default mongoose.model('Employee', employeeSchema);
