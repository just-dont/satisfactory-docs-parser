import {
  createBasicSlug, cleanDescription, standardizeItemDescriptor, equipmentNameToDescriptorName,
  parseStackSize, parseEquipmentSlot, parseCollection, parseColor, Color
} from 'utilities';
import { ClassInfoMap } from 'types';
import { CategoryClasses } from 'class-categories/types';

export type ItemMeta = {
  energyValue?: number,
  radioactiveDecay?: number,
  fluidColor?: Color,
};

export type ItemInfo = {
  slug: string,
  name: string,
  description: string,
  stackSize: number,
  sinkPoints: number,
  isFluid: boolean,
  isFuel: boolean,
  isRadioactive: boolean,
  meta: ItemMeta,
};

export type NodeCounts = {
  impure: number,
  normal: number,
  pure: number,
};

export type WellCounts = {
  impure: number,
  normal: number,
  pure: number,
  wells: number,
};

export type ResourceInfo = {
  itemClass: string,
  form: string,
  nodes?: NodeCounts,
  resourceWells?: WellCounts,
  maxExtraction: number,
  pingColor: Color,
  collectionSpeed: number,
};

export type EquipmentMeta = {
  healthGain?: number,
  energyConsumption?: number,
  sawDownTreeTime?: number,
  damage?: number,
  magSize?: number,
  reloadTime?: number,
  fireRate?: number,
  attackDistance?: number,
  filterDuration?: number,
  sprintSpeedFactor?: number,
  jumpSpeedFactor?: number,
  explosionDamage?: number,
  explosionRadius?: number,
  detectionRange?: number,
};

export type EquipmentInfo = {
  itemClass: string,
  slot: string,
  meta: EquipmentMeta,
};

const christmasItems = [
  'BP_EquipmentDescriptorCandyCane_C',
  'BP_EquipmentDescriptorSnowballMittens_C',
  'Desc_CandyCane_C',
  'Desc_Gift_C',
  'Desc_Snow_C',
  'Desc_SnowballProjectile_C',
  'Desc_XmasBall1_C',
  'Desc_XmasBall2_C',
  'Desc_XmasBall3_C',
  'Desc_XmasBall4_C',
  'Desc_XmasBallCluster_C',
  'Desc_XmasBow_C',
  'Desc_XmasBranch_C',
  'Desc_XmasStar_C',
  'Desc_XmasWreath_C',
  'Desc_CandyCaneDecor_C',
  'Desc_Snowman_C',
  'Desc_WreathDecor_C',
  'Desc_XmassTree_C',
];

const christmasEquip = [
  'Equip_SnowballWeaponMittens_C',
  'Equip_CandyCaneBasher_C',
];

const excludeItems = [
  ...christmasItems,
];

const excludeEquip = [
  ...christmasEquip,
  'Equip_MedKit_C', // Handled as consumable equipment
];

export function parseItems(categoryClasses: CategoryClasses) {
  const items = getItems(categoryClasses);
  const resources = getResources(categoryClasses);
  const equipment = getEquipment(categoryClasses);

  validateItems(items);
  validateResources(resources, items);
  validateEquipment(equipment, items);

  return {
    items,
    resources,
    equipment,
  };
}


function getItems(categoryClasses: CategoryClasses) {
  const items: ClassInfoMap<ItemInfo> = {};

  categoryClasses.itemDescriptors.forEach((entry) => {
    if (excludeItems.includes(entry.ClassName)) {
      return;
    }
    const key = standardizeItemDescriptor(entry.ClassName);
    const energyValue = parseFloat(entry.mEnergyValue);
    const radioactiveDecay = parseFloat(entry.mRadioactiveDecay);

    const isFluid = entry.mForm === 'RF_LIQUID' || entry.mForm === 'RF_GAS';
    const isFuel = energyValue > 0;
    const isRadioactive = radioactiveDecay > 0;

    const meta: ItemMeta = {};
    if (isFluid) {
      meta.fluidColor = parseColor(parseCollection(entry.mFluidColor));
    }
    if (isFuel) {
      meta.energyValue = energyValue;
    }
    if (isRadioactive) {
      meta.radioactiveDecay = radioactiveDecay;
    }

    items[key] = {
      slug: createBasicSlug(entry.mDisplayName),
      name: entry.mDisplayName,
      description: cleanDescription(entry.mDescription),
      stackSize: parseStackSize(entry.mStackSize),
      sinkPoints: parseInt(entry.mResourceSinkPoints, 10),
      isFluid,
      isFuel,
      isRadioactive,
      meta,
    };
  });

  return items;
}

const RESOURCE_NODE_DATA: { [key: string]: NodeCounts } = {
  'Desc_OreIron_C': { impure: 33, normal: 41, pure: 46 },
  'Desc_OreCopper_C': { impure: 9, normal: 28, pure: 12 },
  'Desc_Stone_C': { impure: 12, normal: 47, pure: 27 },
  'Desc_Coal_C': { impure: 6, normal: 29, pure: 15 },
  'Desc_OreGold_C': { impure: 0, normal: 8, pure: 8 },
  'Desc_RawQuartz_C': { impure: 0, normal: 11, pure: 5 },
  'Desc_Sulfur_C': { impure: 1, normal: 7, pure: 3 },
  'Desc_OreUranium_C': { impure: 1, normal: 3, pure: 0 },
  'Desc_OreBauxite_C': { impure: 5, normal: 6, pure: 6 },
  'Desc_LiquidOil_C': { impure: 10, normal: 12, pure: 8 },
};

const RESOURCE_WELL_DATA: { [key: string]: WellCounts } = {
  'Desc_Water_C': { impure: 5, normal: 8, pure: 42, wells: 8 },
  'Desc_LiquidOil_C': { impure: 6, normal: 3, pure: 3, wells: 2 },
  'Desc_NitrogenGas_C': { impure: 2, normal: 7, pure: 36, wells: 6 },
};

const MAX_OVERCLOCK = 2.5;

function getResources(categoryClasses: CategoryClasses) {
  const resources: ClassInfoMap<ResourceInfo> = {};

  categoryClasses.resources.forEach((entry) => {
    const nodeData = RESOURCE_NODE_DATA[entry.ClassName];
    const wellData = RESOURCE_WELL_DATA[entry.ClassName];
    let maxExtraction = 0;

    if (entry.ClassName === 'Desc_Water_C') {
      maxExtraction = Infinity;
    } else {
      if (nodeData) {
        let multiplier = 1;
        let maxThroughput = Infinity;
        if (entry.mForm === 'RF_SOLID') {
          multiplier = 4;
          maxThroughput = 780;
        }
        if (entry.ClassName === 'Desc_LiquidOil_C') {
          multiplier = 2;
          maxThroughput = 600;
        }
        maxExtraction +=
          Math.min(30 * multiplier * MAX_OVERCLOCK, maxThroughput) * nodeData.impure
          + Math.min(60 * multiplier * MAX_OVERCLOCK, maxThroughput) * nodeData.normal
          + Math.min(120 * multiplier * MAX_OVERCLOCK, maxThroughput) * nodeData.pure;
      }
      if (wellData) {
        const multiplier = 1;
        const maxThroughput = 600;
        maxExtraction +=
          Math.min(30 * multiplier * MAX_OVERCLOCK, maxThroughput) * wellData.impure
          + Math.min(60 * multiplier * MAX_OVERCLOCK, maxThroughput) * wellData.normal
          + Math.min(120 * multiplier * MAX_OVERCLOCK, maxThroughput) * wellData.pure;
      }
    }

    resources[entry.ClassName] = {
      itemClass: entry.ClassName,
      form: entry.mForm,
      nodes: nodeData,
      resourceWells: wellData,
      maxExtraction,
      pingColor: parseColor(parseCollection(entry.mPingColor), true),
      collectionSpeed: parseFloat(entry.mCollectSpeedMultiplier),
    };
  });

  return resources;
}


function getEquipment(categoryClasses: CategoryClasses) {
  const equipment: ClassInfoMap<EquipmentInfo> = {};

  categoryClasses.equipment.forEach((entry) => {
    if (excludeEquip.includes(entry.ClassName)) {
      return;
    }
    if (entry.ClassName === 'BP_ConsumeableEquipment_C') {
      categoryClasses.consumables.forEach((consumableInfo) => {
        if (consumableInfo.mHealthGain) {
          const key = consumableInfo.ClassName.replace('Desc_', 'Equip_');
          equipment[key] = {
            itemClass: consumableInfo.ClassName,
            slot: parseEquipmentSlot(entry.mEquipmentSlot),
            meta: {
              healthGain: parseFloat(consumableInfo.mHealthGain),
            }
          };
        }
      });
      return;
    }

    const meta: EquipmentMeta = {};
    if (entry.mEnergyConsumption) {
      meta.energyConsumption = parseFloat(entry.mEnergyConsumption);
    }
    if (entry.mSawDownTreeTime) {
      meta.sawDownTreeTime = parseFloat(entry.mSawDownTreeTime);
    }
    if (entry.mInstantHitDamage) {
      meta.damage = parseFloat(entry.mInstantHitDamage);
    }
    if (entry.mMagSize) {
      meta.magSize = parseInt(entry.mMagSize, 10);
    }
    if (entry.mReloadTime) {
      meta.reloadTime = parseFloat(entry.mReloadTime);
    }
    if (entry.mFireRate) {
      meta.fireRate = parseFloat(entry.mFireRate);
    }
    if (entry.mDamage) {
      meta.damage = parseFloat(entry.mDamage);
    }
    if (entry.mAttackDistance) {
      meta.attackDistance = parseFloat(entry.mAttackDistance);
    }
    if (entry.mFilterDuration) {
      meta.filterDuration = parseFloat(entry.mFilterDuration);
    }
    if (entry.mSprintSpeedFactor) {
      meta.sprintSpeedFactor = parseFloat(entry.mSprintSpeedFactor);
    }
    if (entry.mJumpSpeedFactor) {
      meta.jumpSpeedFactor = parseFloat(entry.mJumpSpeedFactor);
    }
    if (entry.mExplosiveData) {
      const explosiveData = parseCollection(entry.mExplosiveData);
      meta.explosionDamage = parseFloat(explosiveData.ExplosionDamage);
      meta.explosionRadius = parseFloat(explosiveData.ExplosionRadius);
    }
    if (entry.mDetectionRange) {
      meta.detectionRange = parseFloat(entry.mDetectionRange);
    }
    if (entry.mProjectileData) {
      const projectileData = parseCollection(entry.mProjectileData);
      meta.damage = parseFloat(projectileData.ImpactDamage);
    }

    equipment[entry.ClassName] = {
      itemClass: equipmentNameToDescriptorName(entry.ClassName),
      slot: parseEquipmentSlot(entry.mEquipmentSlot),
      meta,
    };
  });

  return equipment;
}

function validateItems(items: ClassInfoMap<ItemInfo>) {
  const slugs: string[] = [];
  Object.entries(items).forEach(([name, data]) => {
    if (!data.slug) {
      // eslint-disable-next-line no-console
      console.warn(`WARNING: Blank slug for item: [${name}]`);
    } else if (slugs.includes(data.slug)) {
      // eslint-disable-next-line no-console
      console.warn(`WARNING: Duplicate item slug: [${data.slug}] of [${name}]`);
    } else {
      slugs.push(data.slug);
    }
  });
}

function validateResources(resources: ClassInfoMap<ResourceInfo>, items: ClassInfoMap<ItemInfo>) {
  Object.entries(resources).forEach(([name, data]) => {
    if (!Object.keys(items).includes(data.itemClass)) {
      // eslint-disable-next-line no-console
      console.warn(`WARNING: Resource missing item descriptor: [${name}]`);
    }
  });
}

function validateEquipment(equipment: ClassInfoMap<EquipmentInfo>, items: ClassInfoMap<ItemInfo>) {
  Object.entries(equipment).forEach(([name, data]) => {
    if (!Object.keys(items).includes(data.itemClass)) {
      // eslint-disable-next-line no-console
      console.warn(`WARNING: Equipment missing item descriptor: [${name}]`);
    }
  });
}
