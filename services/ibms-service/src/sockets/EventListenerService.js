// services/dashboard/EventListenerService.js
import { EventEmitter } from 'events';
import {
  AdmissionProgressNote,
  LabOrderTest,
} from '../../../shared/models/index.js';

class EventListenerService extends EventEmitter {
  constructor() {
    super();
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Listen for critical progress notes
    AdmissionProgressNote.afterCreate(async (note, options) => {
      if (note.is_critical) {
        this.emit('critical_note', note);
      }
    });

    // Listen for critical lab results
    LabOrderTest.afterCreate(async (labTest, options) => {
      if (labTest.is_critical) {
        this.emit('critical_lab', labTest);
      }
    });

    // Listen for model events
    this.on('critical_note', async note => {
      console.log('Critical note created:', note.note_id);
      // Trigger dashboard update
      // You can integrate with WebSocketService here
    });

    this.on('critical_lab', async labTest => {
      console.log('Critical lab result:', labTest.test_id);
      // Send notification
    });
  }
}

export default new EventListenerService();
