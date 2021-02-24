#!/bin/bash
# run your stuff inside of our dev docker container
# eg ./d node ./dist/tests/
# 
# It uses the same network as other dev containers so you can 
# just use hostnames to connect eg. redis or fix-server
export FILE="$@"; docker-compose up exec 
