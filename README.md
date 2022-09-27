# Data api POC

`data-api-poc` A simple project to generate report data.

## installation

To run the project, install it locally using npm:

```bash
npm install
```


## Config

```bash
export EMIL_USERNAME=example@emil.de ----------> Replace me
export EMIL_PASSWORD=SuperStrongPassword ----------> Replace me
export ENV=test
```

Export the ENVs to your terminal:

```bash
source .env
```

## Usage


```bash
npm run report json
```

Passing a specific date:

```bash
npm run report json -- -d=2022-09-22
```

The command will create report.json in the root of the project.

