// MISSION CLOCK FROM THE COMPUTER UTC TIME AND LOCAL CONFIGURATION.
use chrono::{DateTime, Datelike, NaiveTime, Timelike, Utc};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct MissionClock {
    pub utc: String,
    pub doy: u32,
    pub doy_label: String,
    pub met: String,
    pub circadian: String,
    pub mission_state: String,
    pub clock_sync: String,
    pub clock_note: String,
}

pub fn describe(
    now: DateTime<Utc>,
    epoch: Option<DateTime<Utc>>,
    day_start: Option<NaiveTime>,
    day_end: Option<NaiveTime>,
    paused: bool,
    frozen_seconds: i64,
) -> MissionClock {
    let doy = now.ordinal();
    let centiseconds = now.timestamp_subsec_millis() / 10;
    let (met, mission_state) = match epoch {
        Some(_epoch) if paused => (format_elapsed(frozen_seconds.max(0)), "paused".to_string()),
        Some(epoch) => (format_met(now, epoch), "running".to_string()),
        None => ("MET —".to_string(), "idle".to_string()),
    };
    MissionClock {
        utc: format!("{}{centiseconds:02} UTC", now.format("%Y-%m-%d | %H:%M:%S.")),
        doy,
        doy_label: format!("DOY {doy}"),
        met,
        circadian: circadian_label(now, day_start, day_end),
        mission_state,
        clock_sync: "unknown".to_string(),
        clock_note: "Clock synchronization is unknown. The time shown is this computer's UTC clock.".to_string(),
    }
}

pub fn format_met(now: DateTime<Utc>, epoch: DateTime<Utc>) -> String {
    let seconds = now.signed_duration_since(epoch).num_seconds();
    let sign = if seconds < 0 { '-' } else { '+' };
    let absolute = seconds.abs();
    let days = absolute / 86_400;
    let remainder = absolute % 86_400;
    let hours = remainder / 3_600;
    let minutes = (remainder % 3_600) / 60;
    let secs = remainder % 60;
    format!("MET {sign}{days:03}d {hours:02}:{minutes:02}:{secs:02}")
}

pub fn format_elapsed(seconds: i64) -> String {
    let sign = if seconds < 0 { '-' } else { '+' };
    let absolute = seconds.abs();
    let days = absolute / 86_400;
    let remainder = absolute % 86_400;
    let hours = remainder / 3_600;
    let minutes = (remainder % 3_600) / 60;
    let secs = remainder % 60;
    format!("MET {sign}{days:03}d {hours:02}:{minutes:02}:{secs:02}")
}

pub fn circadian_label(now: DateTime<Utc>, day_start: Option<NaiveTime>, day_end: Option<NaiveTime>) -> String {
    let fallback_start = NaiveTime::from_hms_opt(6, 0, 0).expect("06:00");
    let fallback_end = NaiveTime::from_hms_opt(21, 30, 0).expect("21:30");
    let (start, end) = match (day_start, day_end) {
        (Some(start), Some(end)) if start != end => (start, end),
        _ => (fallback_start, fallback_end),
    };
    let current = NaiveTime::from_hms_opt(now.hour(), now.minute(), now.second()).unwrap_or(start);
    let during_day = if start < end {
        current >= start && current < end
    } else {
        current >= start || current < end
    };
    if during_day {
        format!("{}–{} UTC • DAY SHIFT", start.format("%H:%M"), end.format("%H:%M"))
    } else {
        format!("{}–{} UTC • SLEEP CYCLE", end.format("%H:%M"), start.format("%H:%M"))
    }
}

pub fn parse_epoch(text: &str) -> Result<DateTime<Utc>, String> {
    DateTime::parse_from_rfc3339(text.trim())
        .map(|value| value.with_timezone(&Utc))
        .map_err(|_| "Use a UTC time such as 2026-11-14T00:00:00Z.".to_string())
}

pub fn parse_hhmm(text: &str) -> Result<NaiveTime, String> {
    NaiveTime::parse_from_str(text.trim(), "%H:%M")
        .map_err(|_| "Use HH:MM in UTC, such as 06:00.".to_string())
}

pub fn today_utc(now: DateTime<Utc>) -> String {
    now.format("%Y-%m-%d").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at(value: &str) -> DateTime<Utc> {
        parse_epoch(value).unwrap()
    }

    #[test]
    fn day_of_year_matches_the_specification_example() {
        let clock = describe(at("2026-11-14T18:58:00Z"), None, None, None, false, 0);
        assert_eq!(clock.doy, 318);
        assert_eq!(clock.doy_label, "DOY 318");
        assert_eq!(clock.met, "MET —");
        assert_eq!(clock.mission_state, "idle");
        assert!(clock.utc.contains("18:58:00.00 UTC"));
    }

    #[test]
    fn met_counts_configured_elapsed_time() {
        let text = format_met(at("2026-01-02T01:02:03Z"), at("2026-01-01T00:00:00Z"));
        assert_eq!(text, "MET +001d 01:02:03");
        let before = format_met(at("2026-01-01T00:00:00Z"), at("2026-01-01T00:00:01Z"));
        assert_eq!(before, "MET -000d 00:00:01");
    }

    #[test]
    fn circadian_phase_uses_the_configured_utc_window() {
        let start = parse_hhmm("06:00").unwrap();
        let end = parse_hhmm("21:30").unwrap();
        assert!(circadian_label(at("2026-11-14T12:00:00Z"), Some(start), Some(end)).contains("06:00–21:30 UTC • DAY SHIFT"));
        assert!(circadian_label(at("2026-11-14T22:00:00Z"), Some(start), Some(end)).contains("21:30–06:00 UTC • SLEEP CYCLE"));
        assert!(circadian_label(at("2026-11-14T12:00:00Z"), None, None).contains("DAY SHIFT"));
    }
}
