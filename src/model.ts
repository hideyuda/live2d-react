interface Models {
  [key: string]: Model;
}
export interface Model {
  moc3: string;
  model3: string;
  physics3: string;
  textures: string[];
}

export const models: Models = {
  hiyori_free_t08: {
    moc3: `${process.env.PUBLIC_URL}/hiyori_free_t08/hiyori_free_t08.moc3`,
    model3: `${process.env.PUBLIC_URL}/hiyori_free_t08/hiyori_free_t08.model3.json`,
    physics3: `${process.env.PUBLIC_URL}/hiyori_free_t08/hiyori_free_t08.physics3.json`,
    textures: [`${process.env.PUBLIC_URL}/hiyori_free_t08/hiyori_free_t08.2048/texture_00.png`],
  },
};
