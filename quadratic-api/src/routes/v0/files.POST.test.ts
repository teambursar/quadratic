import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { expectError } from '../../tests/helpers';

beforeAll(async () => {
  // Create a test user
  const test_user_1 = await dbClient.user.create({
    data: {
      auth0Id: 'test_user_1',
    },
  });
  const test_user_2 = await dbClient.user.create({
    data: {
      auth0Id: 'test_user_2',
    },
  });
  await dbClient.user.create({
    data: {
      auth0Id: 'test_user_3',
    },
  });
  // Create a team
  await dbClient.team.create({
    data: {
      name: 'test_team_1',
      uuid: '00000000-0000-4000-8000-000000000001',
      stripeCustomerId: '1',
      UserTeamRole: {
        create: [
          {
            userId: test_user_1.id,
            role: 'OWNER',
          },
          {
            userId: test_user_2.id,
            role: 'VIEWER',
          },
        ],
      },
    },
  });
});

afterAll(async () => {
  await dbClient.$transaction([
    dbClient.userTeamRole.deleteMany(),
    dbClient.team.deleteMany(),
    dbClient.fileCheckpoint.deleteMany(),
    dbClient.file.deleteMany(),
    dbClient.user.deleteMany(),
  ]);
});

const validPayload = { name: 'new_file_with_name', contents: 'new_file_contents', version: '1.0.0' };
const expectValidResponse = (res: any) => {
  expect(res.body.file).toHaveProperty('uuid');
  expect(res.body.file).toHaveProperty('name');
  expect(res.body.file.name).toBe('new_file_with_name');
};
const createFile = (payload: any, user: string = 'test_user_1') =>
  request(app).post('/v0/files').send(payload).set('Authorization', `Bearer ValidToken ${user}`);

describe('POST /v0/files', () => {
  describe('bad requests', () => {
    it('rejects unauthorized request', async () => {
      await request(app).post('/v0/files/').send(validPayload).expect(401).expect(expectError);
    });
    it('rejects request with invalid payload', async () => {
      const { name, contents, version } = validPayload;
      await createFile({ name }).expect(400).expect(expectError);
      await createFile({ contents }).expect(400).expect(expectError);
      await createFile({ version }).expect(400).expect(expectError);
      await createFile({ name, contents }).expect(400).expect(expectError);
      await createFile({ name, version }).expect(400).expect(expectError);
      await createFile({ contents, version }).expect(400).expect(expectError);
    });
  });

  describe('create an individual file', () => {
    it('responds with a 201 and creates a file in the user’s personal files', async () => {
      const createResponse = await createFile(validPayload).expect(201).expect(expectValidResponse);
      // check created file
      await request(app)
        .get(`/v0/files/${createResponse.body.file.uuid}`)
        .set('Authorization', `Bearer ValidToken test_user_1`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('file');
          expect(res.body).toHaveProperty('userMakingRequest');
          expect(res.body.userMakingRequest).toHaveProperty('filePermissions');
          expect(res.body.file.name).toEqual('new_file_with_name');
          expect(res.body.file.lastCheckpointVersion).toEqual('1.0.0');
        });
    });
  });

  describe('create a team file', () => {
    it('rejects an invalid request', async () => {
      await createFile({ ...validPayload, teamUuid: 'invalid_uuid' })
        .expect(404)
        .expect(expectError);
    });
    it('rejects creating a file in a team where don’t have permission', async () => {
      await createFile({ ...validPayload, teamUuid: '00000000-0000-4000-8000-000000000001' }, 'test_user_2')
        .expect(403)
        .expect(expectError);
    });
    it('rejects creating a file in a team you don’t have access to', async () => {
      await createFile({ ...validPayload, teamUuid: '00000000-0000-4000-8000-000000000001' }, 'test_user_3')
        .expect(403)
        .expect(expectError);
    });
    it('responds with a 201 and creates a file in a team', async () => {
      const createResponse = await createFile({ ...validPayload, teamUuid: '00000000-0000-4000-8000-000000000001' })
        .expect(201)
        .expect(expectValidResponse)
        .expect((res) => {
          expect(res.body.team.uuid).toBe('00000000-0000-4000-8000-000000000001');
        });
      // check created file
      await request(app)
        .get(`/v0/files/${createResponse.body.file.uuid}`)
        .set('Authorization', `Bearer ValidToken test_user_1`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('file');
          expect(res.body.file.name).toEqual('new_file_with_name');
          expect(res.body.file.lastCheckpointVersion).toEqual('1.0.0');
          expect(res.body).toHaveProperty('team');
          expect(res.body.team.uuid).toEqual('00000000-0000-4000-8000-000000000001');
          expect(res.body).toHaveProperty('userMakingRequest');
          expect(res.body.userMakingRequest).toHaveProperty('filePermissions');
        });
    });
  });
});
