import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
} from 'react-native';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown, 
  Calendar 
} from "lucide-react-native";
import { COLORS } from '../../constants/theme';

interface CalendarModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (date: Date) => void; // returns selected day (local timezone)
  initialDate?: Date;             // defaults to today
  proposedDates?: string[];       // ISO YYYY-MM-DD for highlighting
  acceptedDates?: string[];       // ISO YYYY-MM-DD for highlighting
}

const { width: screenWidth } = Dimensions.get("window");

const CalendarModal: React.FC<CalendarModalProps> = ({
  visible,
  onClose,
  onSelect,
  initialDate,
  proposedDates = [],
  acceptedDates = [],
}) => {
  const base = initialDate || new Date();
  const [year, setYear] = useState(base.getFullYear());
  const [month, setMonth] = useState(base.getMonth()); // 0-indexed

  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const blanks = Array.from({ length: firstDay }, () => 0);
  const days = [...blanks, ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const proposedSet = new Set(proposedDates);
  const acceptedSet = new Set(acceptedDates);

  const label = new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' });

  const handlePrevMonth = () => {
    const m = month === 0 ? 11 : month - 1;
    const y = month === 0 ? year - 1 : year;
    setMonth(m); setYear(y);
  };

  const handleNextMonth = () => {
    const m = month === 11 ? 0 : month + 1;
    const y = month === 11 ? year + 1 : year;
    setMonth(m); setYear(y);
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.calendarContainer}>
          {/* Top bar with close button */}
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <View style={styles.closeButtonOuter}>
                <View style={styles.closeButtonInner}>
                  <ChevronDown size={24} color={COLORS.DARK_TEXT} />
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* Title */}
          <Text style={styles.calendarTitle}>Date Scheduler</Text>

          {/* Content block */}
          <View style={styles.contentBlock}>
            {/* Month selector */}
            <View style={styles.monthSelector}>
              <TouchableOpacity
                style={styles.monthButton}
                onPress={handlePrevMonth}
              >
                <ChevronLeft size={24} color={COLORS.DARK_TEXT} />
              </TouchableOpacity>

              <View style={styles.monthTextContainer}>
                <Calendar size={24} color={COLORS.DARK_TEXT} />
                <Text style={styles.monthText}>{label}</Text>
              </View>

              <TouchableOpacity
                style={styles.monthButton}
                onPress={handleNextMonth}
              >
                <ChevronRight size={24} color={COLORS.DARK_TEXT} />
              </TouchableOpacity>
            </View>

            {/* Days of week */}
            <View style={styles.daysOfWeekContainer}>
              {daysOfWeek.map((day, index) => (
                <Text key={index} style={styles.dayOfWeekText}>
                  {day}
                </Text>
              ))}
            </View>

            {/* Calendar grid */}
            <View style={styles.calendarGrid}>
              {days.map((d, idx) => {
                if (d === 0) {
                  return <View key={`blank-${idx}`} style={[styles.dayButton, { backgroundColor: 'transparent' }]} />;
                }
                const iso = new Date(year, month, d).toISOString().slice(0, 10);
                const isProposed = proposedSet.has(iso);
                const isAccepted = acceptedSet.has(iso);
                return (
                  <TouchableOpacity
                    key={iso}
                    onPress={() => { const selected = new Date(year, month, d); selected.setHours(12,0,0,0); onSelect(selected); onClose(); }}
                    style={[styles.dayButton, isProposed && styles.proposedDay, isAccepted && styles.acceptedDay]}
                  >
                    <Text style={styles.dayText}>{d}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Legend */}
            <View style={styles.legendContainer}>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: COLORS.YELLOW_CARD }]}
                />
                <Text style={styles.legendText}>Proposed</Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: "#10b981" }]}
                />
                <Text style={styles.legendText}>Accepted</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  calendarContainer: {
    backgroundColor: COLORS.YELLOW_CARD,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
  },
  topBar: {
    height: 50,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: COLORS.WHITE_CARD,
    justifyContent: "center",
    alignItems: "center",
    // Add a subtle black divider under the handle to match tray affordance
    borderBottomWidth: 1.25,
    borderBottomColor: COLORS.PRIMARY_BLACK,
  },
  closeButton: {
    position: "absolute",
    alignSelf: "center",
  },
  closeButtonInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.LIGHT_INTERACTIVE_BG,
    alignItems: "center",
    justifyContent: "center",
    // Subtle outline to match app-wide handles
    borderWidth: 1.25,
    borderColor: COLORS.PRIMARY_BLACK,
  },
  // Outer ring to provide the outside outline around the handle (scheduler only)
  closeButtonOuter: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.25,
    borderColor: COLORS.PRIMARY_BLACK,
    backgroundColor: 'transparent',
  },
  calendarTitle: {
    fontSize: 24,
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
    textAlign: "center",
    marginVertical: 20,
  },
  contentBlock: {
    backgroundColor: COLORS.WHITE_CARD,
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 16,
    shadowColor: COLORS.CARD_SHADOW,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    // Subtle outer outline
    borderWidth: 1.25,
    borderColor: COLORS.PRIMARY_BLACK,
  },
  monthSelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    backgroundColor: COLORS.BUTTON_PRESS_BG,
    borderRadius: 50,
    padding: 8,
    // Outline around the month selector pill
    borderWidth: 1.25,
    borderColor: COLORS.PRIMARY_BLACK,
  },
  monthButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.YELLOW_CARD,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.25,
    borderColor: COLORS.PRIMARY_BLACK,
  },
  monthTextContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  monthText: {
    fontSize: 18,
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
    marginLeft: 8,
  },
  daysOfWeekContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 10,
  },
  dayOfWeekText: {
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
    width: (screenWidth - 120) / 7,
    textAlign: "center",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: 20,
  },
  dayButton: {
    width: (screenWidth - 140) / 7,
    height: (screenWidth - 140) / 7,
    margin: 2,
    borderRadius: 12,
    backgroundColor: COLORS.BUTTON_PRESS_BG,
    alignItems: "center",
    justifyContent: "center",
    // Subtle outline for date cells
    borderWidth: 1.25,
    borderColor: COLORS.PRIMARY_BLACK,
  },
  dayText: {
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
  },
  proposedDay: {
    backgroundColor: COLORS.YELLOW_CARD,
  },
  acceptedDay: {
    backgroundColor: "#10b981",
  },
  legendContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    marginTop: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
  },
});

export default CalendarModal;
