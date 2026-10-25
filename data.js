export const CLUB = {
  name: "dyscyber",
  tagline: "Играй на своём уровне",
  description: "Премиальный киберклуб для одиночной игры, командных матчей и ночных сессий.",
  address: "Санкт-Петербург · ежедневно 24/7"
};

export const TARIFFS = {
  hourly: { id: "hourly", name: "Почасовой", shortName: "Почасовой", description: "от 1 до 12 часов" },
  night: { id: "night", name: "Ночной пакет", shortName: "Ночь 22:00–08:00", description: "фиксированные 10 часов" }
};

const COMMON_SPECS = "RTX 4070 SUPER · 16 ГБ ОЗУ · монитор 24″ 240 Гц";
const VIP_SPECS = "RTX 5070 Ti · 32 ГБ ОЗУ · монитор 27″ 360 Гц";
const PRO_SPECS = "Топовые ПК · 32 ГБ ОЗУ · монитор 27″ 540 Гц · шумоизоляция";
const PS5_SPECS = "PlayStation 5 PRO · телевизор 8K · 4 геймпада";

function createComputer({ id, name, zoneId, zoneLabel, category, hourly, night, specs, groupResourceId = null }) {
  return {
    id,
    name,
    resourceType: "computer",
    bookingMode: "single",
    category,
    zoneId,
    zoneLabel,
    groupResourceId,
    hourlyPrice: hourly,
    nightPrice: night,
    specs
  };
}

function createGroup({ id, name, zoneId, zoneLabel, category, hourly, night, specs, memberIds }) {
  return {
    id,
    name,
    resourceType: category === "vip" ? "vip-room" : "pro-zone",
    bookingMode: "group",
    category,
    zoneId,
    zoneLabel,
    hourlyPrice: hourly,
    nightPrice: night,
    specs,
    memberIds
  };
}

const commonComputers = Array.from({ length: 30 }, (_, index) => {
  const number = String(index + 1).padStart(2, "0");
  return createComputer({
    id: `G-${number}`,
    name: `Компьютер G-${number}`,
    zoneId: "common",
    zoneLabel: "Общий зал",
    category: "common",
    hourly: 120,
    night: 1000,
    specs: COMMON_SPECS
  });
});

const vipComputers = [1, 2].flatMap(roomNumber => Array.from({ length: 5 }, (_, index) => {
  const computerNumber = index + 1;
  const roomId = `vip-${roomNumber}`;
  const id = `VIP-${roomNumber}-${String(computerNumber).padStart(2, "0")}`;
  return createComputer({
    id,
    name: `VIP-${roomNumber}-${String(computerNumber).padStart(2, "0")}`,
    zoneId: roomId,
    zoneLabel: `VIP-комната ${roomNumber}`,
    category: "vip",
    hourly: 250,
    night: 1950,
    specs: VIP_SPECS,
    groupResourceId: `VIP-ROOM-${roomNumber}`
  });
}));

const proComputers = [1, 2].flatMap(zoneNumber => Array.from({ length: 5 }, (_, index) => {
  const computerNumber = index + 1;
  const zoneId = `pro-${zoneNumber}`;
  const id = `PRO-${zoneNumber}-${String(computerNumber).padStart(2, "0")}`;
  return createComputer({
    id,
    name: `PRO-${zoneNumber}-${String(computerNumber).padStart(2, "0")}`,
    zoneId,
    zoneLabel: `Pro-зона ${zoneNumber}`,
    category: "pro",
    hourly: 350,
    night: 2950,
    specs: PRO_SPECS,
    groupResourceId: `PRO-ZONE-${zoneNumber}`
  });
}));

const vipGroups = [1, 2].map(roomNumber => {
  const memberIds = vipComputers
    .filter(resource => resource.zoneId === `vip-${roomNumber}`)
    .map(resource => resource.id);
  return createGroup({
    id: `VIP-ROOM-${roomNumber}`,
    name: `VIP-комната ${roomNumber}`,
    zoneId: `vip-${roomNumber}`,
    zoneLabel: `VIP-комната ${roomNumber}`,
    category: "vip",
    hourly: 900,
    night: 9900,
    specs: `${VIP_SPECS} · 5 компьютеров · отдельная комната`,
    memberIds
  });
});

const proGroups = [1, 2].map(zoneNumber => {
  const memberIds = proComputers
    .filter(resource => resource.zoneId === `pro-${zoneNumber}`)
    .map(resource => resource.id);
  return createGroup({
    id: `PRO-ZONE-${zoneNumber}`,
    name: `Pro-зона ${zoneNumber}`,
    zoneId: `pro-${zoneNumber}`,
    zoneLabel: `Pro-зона ${zoneNumber}`,
    category: "pro",
    hourly: 1500,
    night: 14900,
    specs: `${PRO_SPECS} · 5 компьютеров · отдельная шумоизоляция`,
    memberIds
  });
});

const consoleRoom = {
  id: "PS5",
  name: "PS5-комната",
  resourceType: "console-room",
  bookingMode: "single",
  category: "console",
  zoneId: "console",
  zoneLabel: "Консольная комната",
  hourlyPrice: 300,
  nightPrice: 2550,
  specs: PS5_SPECS
};

export const RESOURCES = [
  ...commonComputers,
  ...vipGroups,
  ...vipComputers,
  ...proGroups,
  ...proComputers,
  consoleRoom
];

export const INITIAL_OCCUPIED_RESOURCE_IDS = ["G-07", "VIP-1-03", "PRO-2-04", "PS5"];

export const ZONES = [
  { id: "common", label: "Общий зал", description: "30 игровых станций", groupResourceId: null },
  { id: "vip-1", label: "VIP-комната 1", description: "5 компьютеров или вся комната", groupResourceId: "VIP-ROOM-1" },
  { id: "vip-2", label: "VIP-комната 2", description: "5 компьютеров или вся комната", groupResourceId: "VIP-ROOM-2" },
  { id: "pro-1", label: "Pro-зона 1", description: "5 компьютеров или вся зона", groupResourceId: "PRO-ZONE-1" },
  { id: "pro-2", label: "Pro-зона 2", description: "5 компьютеров или вся зона", groupResourceId: "PRO-ZONE-2" },
  { id: "console", label: "Консольная комната", description: "PlayStation 5 PRO", groupResourceId: null }
];
