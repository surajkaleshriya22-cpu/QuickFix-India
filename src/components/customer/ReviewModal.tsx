import React, { useState } from 'react';
import { X, Star, Check } from 'lucide-react';
import { useQuickFix } from '../../context/QuickFixContext';
import { Booking } from '../../types';

interface ReviewModalProps {
  booking: Booking;
  onClose: () => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({ booking, onClose }) => {
  const { addReview } = useQuickFix();
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>(['Punctual', 'Clean Work']);

  const availableTags = [
    'Punctual',
    'Clean Work',
    'Honest Pricing',
    'Expert Diagnostics',
    'Proper Tools',
    'Polite Behavior',
    'Safety Precautions'
  ];

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addReview(booking.id, rating, comment || 'Great service and quick fix!', selectedTags);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-blue-300 font-bold uppercase tracking-wider">Service Feedback</span>
            <h3 className="text-sm font-bold">Rate {booking.technicianName || 'Technician'}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Star Selection */}
          <div className="text-center py-2">
            <span className="text-xs font-semibold text-slate-500 block mb-2">How was your service experience?</span>
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map(star => {
                const filled = (hoverRating || rating) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                    className="p-1 focus:outline-none transition-transform hover:scale-110 active:scale-95"
                  >
                    <Star
                      className={`w-8 h-8 ${
                        filled ? 'text-amber-400 fill-amber-400' : 'text-slate-200'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
            <span className="text-xs font-bold text-amber-600 mt-1 block">
              {rating === 5 ? 'Exceptional! 5.0' : rating === 4 ? 'Very Good! 4.0' : rating === 3 ? 'Satisfactory' : 'Needs Improvement'}
            </span>
          </div>

          {/* Tag Badges */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-2">What did you like the most?</label>
            <div className="flex flex-wrap gap-1.5">
              {availableTags.map(tag => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                      isSelected
                        ? 'bg-blue-600 text-white font-semibold shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                    <span>{tag}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Written Feedback */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">Write a Review</label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Describe the technician's punctuality, repair quality, and pricing transparency..."
              rows={3}
              className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-3 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 active:scale-95 transition-all"
            >
              Submit Review
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
