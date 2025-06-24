import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema({
  requestId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'complete', 'failed'],
    default: 'pending'
  },
  vendor: {
    type: String,
    enum: ['sync-vendor', 'async-vendor'],
    required: true
  },
  result: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  error: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

jobSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const Job = mongoose.model('Job', jobSchema);

export default Job; 