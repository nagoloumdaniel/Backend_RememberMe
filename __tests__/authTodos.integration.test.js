const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let app;

jest.setTimeout(60000);

const clearDatabase = async () => {
  if (!mongoose.connection?.db) return;
  const collections = await mongoose.connection.db.collections();
  for (const collection of collections) {
    await collection.deleteMany({});
  }
};

beforeAll(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();
  await mongoose.connect(mongoServer.getUri());
  app = require('../api/server');
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

describe('Auth + CRUD Todos', () => {
  test('Refuse /api/todos sans token', async () => {
    const res = await request(app).get('/api/todos');
    expect(res.status).toBe(401);
  });

  test('Permet création et lecture des listes avec JWT', async () => {
    const register = await request(app).post('/api/auth/register').send({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'secret123',
    });

    expect(register.status).toBe(201);
    const token = register.body.token;

    const created = await request(app)
      .post('/api/lists')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Work' });

    expect(created.status).toBe(201);
    expect(created.body._id).toBeTruthy();
    expect(created.body.name).toBe('Work');

    const list = await request(app)
      .get('/api/lists')
      .set('Authorization', `Bearer ${token}`);

    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].name).toBe('Work');
  });

  test('Permet création, lecture, mise à jour, suppression avec JWT', async () => {
    const register = await request(app).post('/api/auth/register').send({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'secret123',
    });

    expect(register.status).toBe(201);
    expect(register.body.token).toBeTruthy();

    const token = register.body.token;

    const created = await request(app)
      .post('/api/todos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Acheter du lait',
        priority: 'high',
        list: 'Home',
        dueTime: '10:30',
      });

    expect(created.status).toBe(201);
    expect(created.body._id).toBeTruthy();
    expect(created.body.title).toBe('Acheter du lait');
    expect(created.body.priority).toBe('high');
    expect(created.body.list).toBe('Home');
    expect(created.body.dueTime).toBe('10:30');

    const todoId = created.body._id;

    const list1 = await request(app)
      .get('/api/todos')
      .set('Authorization', `Bearer ${token}`);

    expect(list1.status).toBe(200);
    expect(Array.isArray(list1.body)).toBe(true);
    expect(list1.body).toHaveLength(1);
    expect(list1.body[0]._id).toBe(todoId);

    const updated = await request(app)
      .put(`/api/todos/${todoId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ completed: true, description: null, dueIme: '09:15' });

    expect(updated.status).toBe(200);
    expect(updated.body._id).toBe(todoId);
    expect(updated.body.completed).toBe(true);
    expect(updated.body.description).toBe('');
    expect(updated.body.dueTime).toBe('09:15');

    const getOne = await request(app)
      .get(`/api/todos/${todoId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(getOne.status).toBe(200);
    expect(getOne.body._id).toBe(todoId);

    const deleted = await request(app)
      .delete(`/api/todos/${todoId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleted.status).toBe(200);
    expect(deleted.body.message).toBeTruthy();

    const list2 = await request(app)
      .get('/api/todos')
      .set('Authorization', `Bearer ${token}`);

    expect(list2.status).toBe(200);
    expect(list2.body).toHaveLength(0);
  });

  test('Empêche accès aux todos d’un autre utilisateur', async () => {
    const a = await request(app).post('/api/auth/register').send({
      name: 'A',
      email: 'a@example.com',
      password: 'secret123',
    });
    const b = await request(app).post('/api/auth/register').send({
      name: 'B',
      email: 'b@example.com',
      password: 'secret123',
    });

    const todo = await request(app)
      .post('/api/todos')
      .set('Authorization', `Bearer ${a.body.token}`)
      .send({ title: 'Privé' });

    expect(todo.status).toBe(201);

    const getOther = await request(app)
      .get(`/api/todos/${todo.body._id}`)
      .set('Authorization', `Bearer ${b.body.token}`);

    expect(getOther.status).toBe(404);
  });

  test('Expose et met à jour le profil utilisateur (settings)', async () => {
    const register = await request(app).post('/api/auth/register').send({
      name: 'Alice',
      email: 'alice2@example.com',
      password: 'secret123',
    });

    expect(register.status).toBe(201);
    const token = register.body.token;

    const me = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(me.status).toBe(200);
    expect(me.body.email).toBe('alice2@example.com');
    expect(typeof me.body.notificationsEnabled).toBe('boolean');

    const updated = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Alice Updated', notificationsEnabled: false, notificationTime: '08:30' });

    expect(updated.status).toBe(200);
    expect(updated.body.name).toBe('Alice Updated');
    expect(updated.body.notificationsEnabled).toBe(false);
    expect(updated.body.notificationTime).toBe('08:30');
  });

  test('Retourne les notifications du jour (todos due aujourd’hui)', async () => {
    const register = await request(app).post('/api/auth/register').send({
      name: 'Notify User',
      email: 'notify@example.com',
      password: 'secret123',
    });

    expect(register.status).toBe(201);
    const token = register.body.token;
    const today = new Date().toISOString().slice(0, 10);

    const created = await request(app)
      .post('/api/todos')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Due today', dueDate: today, dueTime: '07:00' });

    expect(created.status).toBe(201);

    const notif = await request(app)
      .get('/api/notifications/today')
      .set('Authorization', `Bearer ${token}`);

    expect(notif.status).toBe(200);
    expect(notif.body.date).toBe(today);
    expect(Array.isArray(notif.body.todos)).toBe(true);
    expect(notif.body.todos.some((t) => t.title === 'Due today')).toBe(true);

    await request(app)
      .put(`/api/todos/${created.body._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ completed: true });

    const notif2 = await request(app)
      .get('/api/notifications/today')
      .set('Authorization', `Bearer ${token}`);

    expect(notif2.status).toBe(200);
    expect(notif2.body.todos.some((t) => t._id === created.body._id)).toBe(false);
  });
});
