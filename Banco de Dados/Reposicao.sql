CREATE TABLE `usuario` (
  `id` integer PRIMARY KEY,
  `nome` varchar(255),
  `email` varchar(255) UNIQUE,
  `senha` varchar(255)
);

CREATE TABLE `paciente` (
  `id` integer PRIMARY KEY,
  `nome` varchar(255)
);

CREATE TABLE `profissional` (
  `id` integer PRIMARY KEY,
  `nome` varchar(255)
);

CREATE TABLE `reposicao` (
  `id` integer PRIMARY KEY,
  `tempo` integer COMMENT 'Tempo total da reposição em minutos, ex: 40 ou 50'
);

CREATE TABLE `sessaoFaltante` (
  `id` integer PRIMARY KEY,
  `pacienteId` integer,
  `profissionalId` integer,
  `sessaoPerdida` date COMMENT 'Dia original da sessao',
  `reposicaoId` integer,
  `estado` bool COMMENT 'Reposição concluída ou não'
);

CREATE TABLE `minutosRepor` (
  `id` integer PRIMARY KEY,
  `sessaoFaltanteId` integer,
  `minutos` integer COMMENT 'Quantidade de minutos a repor em sessões futuras (ex: 10)',
  `utilizado` bool COMMENT 'Quantos minutos já foram usados'
);

CREATE TABLE `sessao` (
  `id` integer PRIMARY KEY,
  `pacienteiD` integer,
  `profissionalId` integer,
  `data` date,
  `duracao` integer COMMENT 'Tempo da sessão 40 ou 50'
);

CREATE TABLE `complementoSessao` (
  `id` integer PRIMARY KEY,
  `sessaoId` integer,
  `minutosReporId` integer,
  `minutos` integer COMMENT 'Minutos adicionados nesta sessão'
);

ALTER TABLE `sessaoFaltante` ADD FOREIGN KEY (`reposicaoId`) REFERENCES `reposicao` (`id`);

ALTER TABLE `minutosRepor` ADD FOREIGN KEY (`sessaoFaltanteId`) REFERENCES `sessaoFaltante` (`id`);

ALTER TABLE `sessao` ADD FOREIGN KEY (`pacienteiD`) REFERENCES `paciente` (`id`);

ALTER TABLE `sessao` ADD FOREIGN KEY (`profissionalId`) REFERENCES `profissional` (`id`);

ALTER TABLE `complementoSessao` ADD FOREIGN KEY (`sessaoId`) REFERENCES `sessao` (`id`);

ALTER TABLE `complementoSessao` ADD FOREIGN KEY (`minutosReporId`) REFERENCES `minutosRepor` (`id`);
