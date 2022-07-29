import produce from 'immer';
import { i } from './immutableHelpers';
import { set } from './propAccess';

export interface Patch {
  op: 'replace' | 'remove' | 'add';
  path: (string | number)[];
  value?: any;
  prevValue?: any;
}

export function* diff(a: any, b: any, prefix: (string | number)[] = []): Iterable<Patch> {
  console.log('check', prefix.join('/'));

  if (a === b) {
    return;
  }

  if (a instanceof Map && b instanceof Map) {
    for (const [key, value] of a) {
      if (!b.has(key)) {
        yield { op: 'remove', path: [...prefix, key], prevValue: value };
      } else {
        yield* diff(value, b.get(key), [...prefix, key]);
      }
    }

    for (const [key, value] of b) {
      if (!a.has(key)) {
        yield { op: 'add', path: [...prefix, key], value: value };
      }
    }

    return;
  }

  if (a instanceof Object && b instanceof Object) {
    for (const [key, value] of Object.entries(a)) {
      if (!(key in b)) {
        yield { op: 'remove', path: [...prefix, key], prevValue: value };
      } else {
        yield* diff(value, b[key], [...prefix, key]);
      }
    }

    for (const [key, value] of Object.entries(b)) {
      if (!(key in a)) {
        yield { op: 'add', path: [...prefix, key], value: value };
      }
    }

    return;
  }

  yield { op: 'replace', path: prefix, value: b, prevValue: a };
}

const a = {
  id: 'bd8eb937-af89-4398-a8a0-139231b3fc02',
  storeGuid: 'e97d4730-9b8a-49ed-be87-caf4054439aa',
  systemId: 1,
  groupWithSystemId: null,
  name: 'Erdgeschoss',
  mapFile: 'e97d4730-9b8a-49ed-be87-caf4054439aa_0_87bee069f83d0342cec8445397b48c06.png',
  mapBounds: {
    min: {
      x: -9.152062338431374,
      y: -3.9339803188127247,
      systemId: 1,
    },
    max: {
      x: 21.639397878670003,
      y: 38.738370965252244,
      systemId: 1,
    },
  },
  areas: [
    {
      guid: 'b4408485-e8f9-4db4-aed6-bccb24b5eda9',
      name: 'Meeting 1',
      bounds: [
        {
          x: -6.939430832862854,
          y: -2.3441966772079468,
          systemId: 1,
        },
        {
          x: -6.8266167640686035,
          y: 6.197198390960693,
          systemId: 1,
        },
        {
          x: -0.7346434593200684,
          y: 6.140791416168213,
          systemId: 1,
        },
        {
          x: -0.7346435785293579,
          y: -2.3441966772079468,
          systemId: 1,
        },
      ],
      flags: [],
    },
    {
      guid: '30d48095-5a03-4d80-ae01-5bad847d2dd1',
      name: 'HR & CO',
      bounds: [
        {
          x: -7.091573476791382,
          y: 6.575562000274658,
          systemId: 1,
        },
        {
          x: -7.098456473751086,
          y: 12.86458288694337,
          systemId: 1,
        },
        {
          x: -0.9043011144828972,
          y: 12.870321145305187,
          systemId: 1,
        },
        {
          x: -0.9889212846755981,
          y: 6.533184051513672,
          systemId: 1,
        },
      ],
      flags: [],
    },
    {
      guid: '89eae6c5-a5e0-487d-a403-24805308e62d',
      name: 'Küche',
      bounds: [
        {
          x: -7.131148338317871,
          y: 17.988630294799805,
          systemId: 1,
        },
        {
          x: -7.021349906921387,
          y: 21.55713653564453,
          systemId: 1,
        },
        {
          x: -0.8176367282867432,
          y: 21.502235412597656,
          systemId: 1,
        },
        {
          x: -0.8176367282867432,
          y: 20.184633255004883,
          systemId: 1,
        },
        {
          x: -3.6724424362182617,
          y: 20.074832916259766,
          systemId: 1,
        },
        {
          x: -3.6724424362182617,
          y: 17.988630294799805,
          systemId: 1,
        },
      ],
      textBounds: {
        min: {
          x: -0.8475909233093262,
          y: 1.2290058135986328,
          systemId: 1,
        },
        max: {
          x: 2.052409076690674,
          y: 4.466167373657228,
          systemId: 1,
        },
      },
      flags: [],
    },
    {
      guid: '2c4912fd-0ff6-4914-9c5a-f7eb3108584b',
      name: 'Frank',
      bounds: [
        {
          x: -6.755214468128365,
          y: 28.272604444486124,
          systemId: 1,
        },
        {
          x: -6.801526323444527,
          y: 32.0418495921912,
          systemId: 1,
        },
        {
          x: -0.5494269286462481,
          y: 32.0418495921912,
          systemId: 1,
        },
        {
          x: -0.5494269286462481,
          y: 28.226292112332803,
          systemId: 1,
        },
      ],
      textBounds: {
        min: {
          x: 0.7441025682267011,
          y: 0.04110488425662595,
          systemId: 1,
        },
        max: {
          x: 6.99620196302498,
          y: 3.6071163130896338,
          systemId: 1,
        },
      },
      flags: [],
    },
    {
      guid: '401ef4aa-b483-4aff-828a-2b1a5e37c69a',
      name: 'Rollout',
      bounds: [
        {
          x: 0.560084342956543,
          y: 28.672582626342773,
          systemId: 1,
        },
        {
          x: 0.6535898447036743,
          y: 33.439231872558594,
          systemId: 1,
        },
        {
          x: 7.6686126804351815,
          y: 33.464892349243165,
          systemId: 1,
        },
        {
          x: 7.6686126804351815,
          y: 28.672582626342773,
          systemId: 1,
        },
      ],
      flags: [],
    },
    {
      guid: '0ec23590-5dc0-40b8-8d22-aa34f770f29c',
      name: 'Server',
      bounds: [
        {
          x: 1.1676647996902467,
          y: 8.157316055297851,
          systemId: 1,
        },
        {
          x: 1.1676647996902467,
          y: 12.977403602600099,
          systemId: 1,
        },
        {
          x: 5.1376647996902465,
          y: 12.977403602600099,
          systemId: 1,
        },
        {
          x: 5.1376647996902465,
          y: 9.74658706665039,
          systemId: 1,
        },
        {
          x: 3.9076647996902465,
          y: 9.74658706665039,
          systemId: 1,
        },
        {
          x: 3.9076647996902465,
          y: 8.157316055297851,
          systemId: 1,
        },
      ],
      textBounds: {
        min: {
          x: -0.45360565185546875,
          y: -0.1999073028564453,
          systemId: 1,
        },
        max: {
          x: 3.516394348144531,
          y: 4.670092697143556,
          systemId: 1,
        },
      },
      flags: [],
    },
    {
      guid: '48dfd5a7-4ae5-483f-8adf-2a1e7287302a',
      name: 'Toiletten',
      bounds: [
        {
          x: 5.0566725730896,
          y: 7.338008880615234,
          systemId: 1,
        },
        {
          x: 5.111573696136475,
          y: 13.047619819641113,
          systemId: 1,
        },
        {
          x: 10.272184371948242,
          y: 13.157421112060547,
          systemId: 1,
        },
        {
          x: 10.272184371948242,
          y: 7.392908096313477,
          systemId: 1,
        },
      ],
      textBounds: {
        min: {
          x: -0.11281394958496094,
          y: 0.05640697479248047,
          systemId: 1,
        },
        max: {
          x: 5.197186050415039,
          y: 5.496406974792482,
          systemId: 1,
        },
      },
      flags: [],
    },
    {
      guid: 'a94eecc6-ebd5-495b-a7ae-253792087a13',
      name: 'Meeting 2',
      bounds: [
        {
          x: 10.730908189028725,
          y: 7.361462179424626,
          systemId: 1,
        },
        {
          x: 10.67478617612677,
          y: 13.16235857418834,
          systemId: 1,
        },
        {
          x: 15.188106728313159,
          y: 13.102036721995885,
          systemId: 1,
        },
        {
          x: 15.242947887898207,
          y: 7.357532736083686,
          systemId: 1,
        },
      ],
      textBounds: {
        min: {
          x: 0.000003814697265625,
          y: 0.05640697479248047,
          systemId: 1,
        },
        max: {
          x: 4.963833808898926,
          y: 5.715113143920899,
          systemId: 1,
        },
      },
      flags: [],
    },
    {
      guid: '2f8cdd1a-d161-4510-ac27-51b8095b67a5',
      name: 'Front Office',
      bounds: [
        {
          x: 15.438692092895508,
          y: 7.251120090484619,
          systemId: 1,
        },
        {
          x: 15.425596237182617,
          y: 13.107210159301758,
          systemId: 1,
        },
        {
          x: 20.648303985595703,
          y: 13.047619819641113,
          systemId: 1,
        },
        {
          x: 20.648303985595703,
          y: 7.338008880615234,
          systemId: 1,
        },
      ],
      textBounds: {
        min: {
          x: 0,
          y: 0,
          systemId: 1,
        },
        max: {
          x: 5.167808532714844,
          y: 5.856090068817139,
          systemId: 1,
        },
      },
      flags: [],
    },
    {
      guid: 'ad93640e-4a84-4dac-b4ae-169a16209417',
      name: 'UN',
      bounds: [
        {
          x: -0.6059777140617371,
          y: -2.2869770526885986,
          systemId: 1,
        },
        {
          x: -0.6558861136436462,
          y: 4.400854110717773,
          systemId: 1,
        },
        {
          x: 15.207010507583618,
          y: 4.242438316345215,
          systemId: 1,
        },
        {
          x: 15.094196557998657,
          y: -2.3571979999542236,
          systemId: 1,
        },
      ],
      flags: [],
    },
    {
      guid: '3b0b61c1-683a-48aa-967d-7e99cbdade26',
      name: 'Operations/DEV',
      bounds: [
        {
          x: 1.0081095736259071,
          y: 28.323212018285425,
          systemId: 1,
        },
        {
          x: 8.004110101961478,
          y: 28.355676999364526,
          systemId: 1,
        },
        {
          x: 8.005268096923828,
          y: 13.483648300170898,
          systemId: 1,
        },
        {
          x: 1.0092675685882568,
          y: 13.483648300170898,
          systemId: 1,
        },
        {
          x: 1.0092675685882568,
          y: 17.996688842773438,
          systemId: 1,
        },
        {
          x: 1.0092675685882568,
          y: 17.996688842773438,
          systemId: 1,
        },
        {
          x: 2.0250539779663086,
          y: 17.996688842773438,
          systemId: 1,
        },
        {
          x: 2.0250539779663086,
          y: 21.182220458984375,
          systemId: 1,
        },
        {
          x: 1.0092675685882568,
          y: 21.182220458984375,
          systemId: 1,
        },
        {
          x: 1.0092675685882568,
          y: 28.106136322021484,
          systemId: 1,
        },
      ],
    },
    {
      guid: 'edad0214-f874-4df5-aa3f-014d79e0e5c7',
      name: 'Flur',
      bounds: [
        {
          x: -0.5948215126991272,
          y: 28.073671340942383,
          systemId: 1,
        },
        {
          x: 1.0092675685882568,
          y: 28.073671340942383,
          systemId: 1,
        },
        {
          x: 1.0092675685882568,
          y: 7.062990665435791,
          systemId: 1,
        },
        {
          x: 18.455923080444336,
          y: 7.062990665435791,
          systemId: 1,
        },
        {
          x: 18.455923080444336,
          y: 5.301549911499023,
          systemId: 1,
        },
        {
          x: -0.9322065711021423,
          y: 5.301549911499023,
          systemId: 1,
        },
        {
          x: -0.5948215126991272,
          y: 27.915124893188477,
          systemId: 1,
        },
        {
          x: -0.5948215126991272,
          y: 28.073671340942383,
          systemId: 1,
        },
      ],
      textBounds: {
        min: {
          x: 0.4112526774406433,
          y: -0.2843031883239746,
          systemId: 1,
        },
        max: {
          x: 2.3527268171310425,
          y: 22.323116302490234,
          systemId: 1,
        },
      },
    },
    {
      guid: '98bb8014-1781-44a1-8012-6ad7da12eec9',
      name: 'HW',
      bounds: [
        {
          x: -6.591267964177054,
          y: 28.169326992839924,
          systemId: 1,
        },
        {
          x: -0.9821719650299476,
          y: 28.169326992839924,
          systemId: 1,
        },
        {
          x: -0.9821719650299476,
          y: 21.967038382981542,
          systemId: 1,
        },
        {
          x: -6.591267964177054,
          y: 21.967038382981542,
          systemId: 1,
        },
      ],
    },
  ],
  poi: [
    {
      guid: 'bb867fb1-4c64-4057-bc5e-78dbc066b4af',
      name: 'O&G',
      icon: 'obst_und_gemuese',
      coordinate: {
        x: -3.9280202388763428,
        y: -0.6636708378791809,
        systemId: 1,
      },
      flags: [],
    },
    {
      guid: '37139086-6790-4760-960d-51e4488c2b1f',
      name: 'Bedientheke',
      icon: 'bedientheke',
      coordinate: {
        x: 15,
        y: 0,
        systemId: 1,
      },
      flags: [],
    },
    {
      guid: 'ca863282-050c-4621-8b7b-49988fe859ec',
      name: 'Getränke',
      icon: 'getraenke',
      coordinate: {
        x: 10,
        y: 0,
        systemId: 1,
      },
      flags: [],
    },
    {
      guid: '2c235d5b-2743-4a91-88ea-6fe17a4e706e',
      name: 'Backwaren',
      icon: 'backwaren',
      coordinate: {
        x: 5,
        y: 0,
        systemId: 1,
      },
      flags: [],
    },
    {
      guid: 'ace1058b-461e-4234-9218-3618ac1e36e2',
      name: 'Kasse',
      icon: 'kasse',
      coordinate: {
        x: 11.94528865814209,
        y: 10.037175178527832,
        systemId: 1,
      },
      flags: ['checkout'],
    },
    {
      guid: '73e7a501-14e1-4b3e-921f-c693acc6fd62',
      name: 'Stefs POI',
      icon: 'drogerie',
      coordinate: {
        x: 3.689525842666626,
        y: 28.975465774536133,
        systemId: 1,
      },
      flags: null,
    },
    {
      guid: 'e869fad8-30b5-488f-a209-edada5b9319e',
      name: 'Utes POI',
      icon: 'haushalt',
      coordinate: {
        x: -5.911691188812256,
        y: 19.77935791015625,
        systemId: 1,
      },
      flags: null,
    },
  ],
  anchors: [
    {
      guid: 'a7c66ce1-66f4-41b6-8eed-4a66615b0102',
      name: 'Anchor 1',
      coordinate: {
        x: 19.14,
        y: 8.31,
        systemId: 1,
      },
      relativeCoordinate: {
        x: 0.9488116297228583,
        y: 0.2907350470380085,
        systemId: 1,
      },
    },
    {
      guid: '5cedeb5c-349b-4aa9-a847-f33b525c7245',
      name: 'Anchor 24',
      coordinate: {
        x: -5.57,
        y: 28.01,
        systemId: 1,
      },
      relativeCoordinate: {
        x: 0.0963557633672135,
        y: 0.7396176528930664,
        systemId: 1,
      },
    },
    {
      guid: '00d8da99-7dbe-482f-8aa9-36b96df11c09',
      name: 'Anchor 11',
      coordinate: {
        x: -2.32,
        y: -0.23,
        systemId: 1,
      },
      relativeCoordinate: {
        x: 0.21525229790179945,
        y: 0.0537159090613171,
        systemId: 1,
      },
    },
    {
      guid: '3d1f7e00-a587-4e7a-be39-2db6ac976fbf',
      name: 'Anchor 27',
      coordinate: {
        x: 6.69,
        y: 31.27,
        systemId: 1,
      },
      relativeCoordinate: {
        x: 0.5276411893778857,
        y: 0.8142289911984035,
        systemId: 1,
      },
    },
    {
      guid: '3e654bfb-17df-4025-a6ca-e8278389286c',
      name: 'Anchor 17',
      coordinate: {
        x: 5.89,
        y: 12.63,
        systemId: 1,
      },
      relativeCoordinate: {
        x: 0.5153597654169176,
        y: 0.4105042442053406,
        systemId: 1,
      },
    },
    {
      guid: '3bde1e25-2213-4540-87a8-e399876c5b9f',
      name: 'Anchor 14',
      coordinate: {
        x: 0.89,
        y: 11.42,
        systemId: 1,
      },
      relativeCoordinate: {
        x: 0.2562103310918096,
        y: 0.35310006150402656,
        systemId: 1,
      },
    },
    {
      guid: '40c9d506-674b-4a39-ba9e-da8266973fc7',
      name: 'Anchor 7',
      coordinate: {
        x: 6.7,
        y: 23.632,
        systemId: 1,
      },
      relativeCoordinate: {
        x: 0.5413728630104793,
        y: 0.6793684469461387,
        systemId: 1,
      },
    },
  ],
  portals: [
    {
      guid: 'b5e18e66-a3b9-11ec-8f12-97c0b4d48585',
      name: 'Aufzug A',
      icon: 'elevator',
      coordinate: {
        x: 0,
        y: 30.5,
        systemId: 1,
      },
      portalsTo: [
        {
          portalGuid: '3cc0459e-ef1b-4b8e-b7fe-99b120116bcb',
          distance: 1,
          inaccessible: false,
        },
        {
          portalGuid: 'cad283c7-981b-4441-b731-4933882e1543',
          distance: 1,
          inaccessible: false,
        },
        {
          portalGuid: '6046750b-d106-4e9f-a029-7f974b4af61e',
          distance: 0,
          inaccessible: false,
        },
      ],
    },
    {
      guid: '6d54a7aa-5319-486b-8adb-de3224664775',
      name: 'Treppe',
      icon: 'stairs',
      coordinate: {
        x: -4.867648601531982,
        y: 3.5062010288238525,
        systemId: 1,
      },
      portalsTo: [
        {
          portalGuid: '5b6d516a-b30e-404b-a55d-5158deac673f',
          distance: 10,
          inaccessible: true,
        },
      ],
    },
  ],
  modifiedBy: 'marco.schumacher@pentlandfirth.com',
  createdBy: 'uwgt',
  createdOn: '2022-04-07T12:26:14.978Z',
  modifiedOn: '2022-07-18T10:42:07.303Z',
};
// const b = set(
//   a,
//   'areas',
//   i.update((x) => x.name === 'Küche', i.set('textBounds.min', { x: 0, y: 0, systemId: 0 }))
// );
const b = produce(a, (a) => {
  const area = a.areas.find((x) => x.name === 'Küche');
  if (area?.textBounds) {
    area.textBounds.min = { x: 0, y: 0, systemId: 0 };
  }
});

console.log(...diff(a, b));
