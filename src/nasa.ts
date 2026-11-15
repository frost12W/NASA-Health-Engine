// NASA HUMAN RESEARCH PROGRAM TEXT, QUOTED FOR OFFLINE USE.
// Read from https://www.nasa.gov/hrp/hazards/ on 2026-11-15.
// That page is the NASA source listed on the Space Apps health-monitoring resources tab.

export const NASA_HAZARDS_PAGE = "https://www.nasa.gov/hrp/hazards/";
export const NASA_RISKS_PAGE = "https://www.nasa.gov/hrp/risks/";
export const NASA_RESEARCH_PAGE = "https://www.nasa.gov/hrp/ongoing-hrp-research/";

export const NASA_HAZARDS = [
  {
    id: "radiation",
    name: "Space Radiation",
    summary: "Invisible to the human eye, space radiation is not only stealthy but considered one of the most hazardous aspects of spaceflight.",
  },
  {
    id: "isolation",
    name: "Isolation and Confinement",
    summary: "Behavioral responses occur among groups of people far from Earth who are isolated and confined in a small space over a long period of time.",
  },
  {
    id: "distance",
    name: "Distance from Earth",
    summary: "Instructions, new supplies, medical care, and more become increasingly challenging to receive from Earth as astronauts venture deeper into space.",
  },
  {
    id: "gravity",
    name: "Gravity Fields",
    summary: "Astronauts' entire bodies – muscles, bones, inner ear, and organs – must adjust to the new gravities encountered on the space station or their spacecraft, as well as on the Moon, Mars, and Earth once they return home.",
  },
  {
    id: "environment",
    name: "Hostile/Closed Environments",
    summary: "Maintaining a safe ecosystem inside a spacecraft presents unique challenges, from ensuring optimal temperatures, pressures, and lighting, to reducing noise, monitoring microbial communities, and tracking immune responses.",
  },
] as const;
