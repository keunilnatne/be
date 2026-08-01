require('express-async-errors');
const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// 태그 기반 변환 데모용 정적 페이지 (public/index.html)
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api', routes);

// TODO: 404 핸들러 필요 시 추가

app.use(errorHandler);

module.exports = app;
